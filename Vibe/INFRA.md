# INFRA.md — インフラ構成

> 出典: `compose.yml` / `compose.dev.yml` / `Dockerfile` / `.dockerignore` / `scripts/thread.ps1` / `next.config.ts`

## 1. 構成要素の全体像

| 要素 | 内容 |
| --- | --- |
| アプリ | Next.js 16 (App Router)、`output: 'standalone'` |
| DB | PostgreSQL 16（`postgres:16-alpine`） |
| キャッシュ/キュー等 | なし（Redis 等のミドルウェアは不使用） |
| 計測 | @vercel/analytics / @vercel/speed-insights（`app/layout.tsx` に埋め込み）、next-axiom（`withAxiom` で next.config をラップ、`log.middleware(request)` を proxy で呼び出し） |
| ログ | `logs/YYYY-MM-DD.log`（JSON Lines、JST 日付ローテーション） |

**デプロイ方針（決定事項）: 自前 Docker 運用**（§4 の Dockerfile 3 ステージビルド）。IaC・CI/CD 設定はリポジトリに存在しない（GitHub Actions 等なし）。コード内に Vercel 検出（`process.env.VERCEL`）や Analytics/Speed Insights が残っているが、これは互換のため実装として維持するだけでよく、Vercel へのデプロイは行わない。

## 2. compose.yml（標準のローカル/本番相当環境）

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_DB: watchlog, POSTGRES_USER: watchlog, POSTGRES_PASSWORD: watchlog }
    volumes: [ postgres_data:/var/lib/postgresql/data ]
    healthcheck: pg_isready -U watchlog -d watchlog（5s 間隔、timeout 5s、retries 10）
    restart: unless-stopped
  app:
    image: node:24-alpine        # Dockerfile は使わずソースを直接マウント
    working_dir: /app
    volumes: [ .:/app, node_modules:/app/node_modules ]
    ports: [ "3000:3000" ]
    env_file: .env
    environment: { DATABASE_URL: postgresql://watchlog:watchlog@db:5432/watchlog?schema=public }
    command: sh -c "npm ci && npx prisma migrate deploy && npm run build && npm run start"
    depends_on: { db: { condition: service_healthy } }
volumes: [ postgres_data, node_modules ]
```

要点:
- `app` サービスは **Dockerfile をビルドしない**。`node:24-alpine` にソースをバインドマウントし、起動時に `npm ci → prisma migrate deploy → next build → next start`（本番モード）。
- `node_modules` は名前付きボリューム。Windows ホストのバイナリと Linux コンテナのバイナリの混在を防ぐ。
- `DATABASE_URL` は compose が上書きするので `.env` の値は無視される。
- 初期データ投入: `docker compose exec app npm run prisma:seed`

## 3. compose.dev.yml（並列開発スレッド）

`scripts/thread.ps1`（PowerShell 5.1+）で操作する。スレッド N（1〜9）→ アプリ `localhost:300N` / DB `localhost:550N`。

- `COMPOSE_PROJECT_NAME=watchlog-<N>` によりボリューム・ネットワークが完全分離。
- compose.yml との差分:
  - DB ポートをホストへ公開（`${DB_PORT:-5501}:5432`）
  - `prisma_client:/app/app/generated` ボリューム追加（生成 Prisma Client の Linux/Windows バイナリ衝突防止）
  - `.env` と `.env.local` を `required: false` で読み込み
  - `NEXTAUTH_URL` をスレッドのポートへ上書き、`NODE_ENV=development`、`TZ=Asia/Tokyo`
  - 起動コマンドは `npm ci && npx prisma generate && npx prisma migrate deploy && npm run dev`（ホットリロード）

コマンド: `start <N>` / `logs <N>` / `stop <N>` / `down <N>` / `status` / `new <N> [branch]`（`new` は `../WatchLog-<N>` に git worktree を作成。ブランチ省略時 `thread/N`）。

## 4. Dockerfile（本番イメージ、3 ステージ）

| ステージ | ベース | 内容 |
| --- | --- | --- |
| deps | node:24-alpine | `npm ci --ignore-scripts` |
| builder | node:24-alpine | `npx prisma generate`（DATABASE_URL はダミーで可）→ ダミー環境変数付きで `npm run build`（[ENV.md](./ENV.md) §4 参照） |
| runner | node:24-alpine | `NODE_ENV=production`, `TZ=Asia/Tokyo`, `PORT=3000`, `HOSTNAME=0.0.0.0`。非 root ユーザー `nextjs`(uid 1001)/`nodejs`(gid 1001)。`public/`・`.next/standalone`・`.next/static` のみコピー。`/app/logs` を作成し所有権付与。`CMD ["node", "server.js"]`、EXPOSE 3000 |

`.dockerignore`: `node_modules` / `.next` / `.git` / `logs` / `*.md`。

## 5. next.config.ts の関連設定

```ts
process.env.TZ = "Asia/Tokyo";        // モジュール読み込み時に強制
output: 'standalone'
allowedDevOrigins: ["127.0.0.1"]
images.remotePatterns: static.showroom-live.com / image.showroom-cdn.com (https)
export default withAxiom(nextConfig)  // next-axiom ラッパー
```

注意: `images.remotePatterns` が設定されているが、アプリ全体の方針として `next/image` は使わず `<img>` タグを使用する（設定は残置。維持してよい）。

## 6. ネットワーク・依存関係図

```
[Browser] ──HTTP──> [Next.js app :3000]
   │                    │
   │                    ├──TCP──> [PostgreSQL :5432 (service名 db)]
   │                    ├──HTTPS──> www.showroom-live.com (REST API / HTML)
   │                    └──(任意) Axiom / Vercel Analytics
   └──WSS──> online.showroom-live.com (SHOWROOM WebSocket、ブラウザから直結)
   └──HTTPS──> *.showroom-cdn.com / static.showroom-live.com (画像・HLS はブラウザから直接取得)
```

SHOWROOM の WebSocket・HLS ストリーム・画像は**ブラウザが直接**取得する。サーバーは REST API / HTML 検索のプロキシのみ（`lib/showroom/`）。
