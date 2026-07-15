# ENV.md — 環境変数一覧

> 出典: 実装コード（`lib/env.ts` / `auth.ts` / `lib/prisma.ts` / `lib/logger.ts` / `proxy.ts` / `next.config.ts` / `Dockerfile` / `compose.yml` / `compose.dev.yml` / `vitest.config.mts`）から抽出。
> `.env.example` はリポジトリに存在しない（`.env` / `.env.local` は gitignore 対象。実在ファイルのキーは下記「必須」欄と一致することを確認済み）。
> `NEXT_PUBLIC_` プレフィックス付きは 1 つのみ（`NEXT_PUBLIC_AXIOM_TOKEN`）。それ以外はすべてサーバー限定。

## 1. アプリ必須（起動時に `assertRequiredEnv` で検証）

`auth.ts` のモジュール読み込み時に以下 5 つが無いと即例外で起動失敗する。

| 変数名 | 必須 | 用途 | 例 |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL 接続文字列。`lib/prisma.ts`（`@prisma/adapter-pg`）と `prisma.config.ts` が参照 | `postgresql://watchlog:watchlog@localhost:5432/watchlog` |
| `AUTH_SECRET` | Yes | NextAuth v5 の署名シークレット | ランダム長文字列 |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth Client ID | `xxx.apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth Client Secret | — |
| `NEXTAUTH_URL` | Yes | アプリのベース URL | `http://localhost:3000` |

Google OAuth リダイレクト URI: `{NEXTAUTH_URL}/api/auth/callback/google`（並列開発時は `http://localhost:3001..3009/...` も登録）。

## 2. 任意（挙動を変えるもの）

| 変数名 | 既定値 | 用途 | 参照箇所 |
| --- | --- | --- | --- |
| `LOG_LEVEL` | 本番 `info` / それ以外 `debug` | `debug` \| `info` \| `warn` \| `error`。アプリログの最小レベル | `lib/logger.ts` |
| `LOG_FLG` | 未設定 | `skip` を設定するとログファイル（`logs/YYYY-MM-DD.log`）への書き込みをスキップ | `lib/logger.ts` |
| `NEXT_PUBLIC_AXIOM_TOKEN` | 未設定 | 設定時のみ next-axiom の `Logger` を初期化しログを Axiom へ転送 | `lib/logger.ts` |
| `VERCEL` | 未設定 | Vercel 上ではファイルログを書かない・ページアクセスログを抑制 | `lib/logger.ts` / `proxy.ts` |
| `TZ` | コードが `Asia/Tokyo` を強制設定 | `next.config.ts` / `prisma.config.ts` / `lib/server-timezone.ts` が `process.env.TZ = "Asia/Tokyo"` を実行。環境変数として与える必要はないが、コンテナでは明示設定している | Dockerfile / compose.dev.yml |
| `NODE_ENV` | — | `production` でログ形式が JSON 1 行、Prisma シングルトンの global キャッシュ無効化 | `lib/logger.ts` / `lib/prisma.ts` |
| `NEXT_TELEMETRY_DISABLED` | — | Dockerfile が `1` を設定 | Dockerfile |

## 3. compose 経由で注入されるもの（`.env` より優先）

### compose.yml（本番相当・単一環境）

| 変数名 | 値 | 備考 |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://watchlog:watchlog@db:5432/watchlog?schema=public` | `environment:` で上書きするため `.env` の値は使われない |
| （その他） | `.env` を `env_file` として読み込み | `AUTH_*` / `NEXTAUTH_URL` は `.env` から |

### compose.dev.yml（並列開発スレッド）

| 変数名 | 値 | 備考 |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://watchlog:watchlog@db:5432/watchlog?schema=public` | 上書き |
| `NEXTAUTH_URL` | `http://localhost:${APP_PORT:-3001}` | 上書き |
| `NODE_ENV` | `development` | |
| `TZ` | `Asia/Tokyo` | |
| `LOG_LEVEL` | `${LOG_LEVEL:-debug}` | |
| （その他） | `.env` / `.env.local` を任意読み込み（`required: false`） | AUTH 系はそのまま流用 |

### thread.ps1 が設定するホスト側変数

| 変数名 | 値 | 用途 |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `watchlog-<N>` | スレッドごとのボリューム・ネットワーク分離 |
| `APP_PORT` | `300<N>`（3001〜3009） | アプリ公開ポート |
| `DB_PORT` | `550<N>`（5501〜5509） | PostgreSQL 公開ポート |

## 4. ビルド専用ダミー値（Dockerfile）

Next.js のビルド（page data collection）が Prisma/Auth.js の初期化を走らせるため、`Dockerfile` のビルドステージでは以下にダミー値を与える。**ランタイムイメージには焼き込まれない**。

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`

（`AUTH_URL` / `AUTH_TRUST_HOST` / `NEXTAUTH_SECRET` はビルド時のみ登場。アプリコードは直接参照していない。`trustHost: true` は `auth.ts` にハードコード）

## 5. テスト環境

| 変数名 | 値 | 備考 |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://test:test@localhost:5432/test` | `vitest.config.mts` の `test.env` で自動注入。実 DB には接続しない（Prisma はテストでモックされる） |

## 6. ローカル `.env` テンプレート

```env
DATABASE_URL="postgresql://watchlog:watchlog@localhost:5432/watchlog"
AUTH_SECRET="your-long-random-secret"
AUTH_GOOGLE_ID="Google OAuth Client ID"
AUTH_GOOGLE_SECRET="Google OAuth Client Secret"
NEXTAUTH_URL="http://localhost:3000"
LOG_LEVEL="debug"   # 任意
```
