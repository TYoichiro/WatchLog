# CLAUDE.md — WatchLog 再実装 開発ガイド

新規実装セッションが常に参照する開発ガイド。**このリポジトリ（Vibe/ 配下のドキュメント）だけを頼りに、元実装と同一挙動の WatchLog を作る**ことがゴール。

## プロジェクト概要

WatchLog は SHOWROOM（日本のライブ配信サービス）の配信ログツール。配信者が Google ログイン＋招待コードで自分のルームを登録すると、ダッシュボード表示・配信開始の自動検知・配信中のコメント/ギフト/ランキングのリアルタイム閲覧・配信終了時のログ自動保存・振り返りサマリー・ユーザーブロック・管理機能を提供する。UI は全編日本語、時刻はすべて JST。機能仕様の全量は [SPEC.md](./SPEC.md)。

## 技術スタックと採用理由

| 技術 | バージョン | 備考 |
| --- | --- | --- |
| Next.js | **16.2.9**（App Router） | `output: 'standalone'`。Middleware は **`proxy.ts`** にリネームされている世代。**API を使う前に `node_modules/next/dist/docs/` の同梱ドキュメントを必ず読む**（旧世代と破壊的差分あり） |
| React | 19.2.4 | Server Components 前提 |
| TypeScript | 5（strict） | `@/*` = リポジトリルート alias |
| Prisma | 7.8.0 | generator `prisma-client`（新方式）、出力先 **`app/generated/prisma`**、`@prisma/adapter-pg` driver adapter、`prisma.config.ts` で datasource url 供給 |
| PostgreSQL | 16 | compose 管理。JST 壁時計を格納（[DATA_MODEL.md](./DATA_MODEL.md) §0） |
| NextAuth | 5.0.0-beta.31 | Google のみ・DB セッション 180 日・PrismaAdapter |
| Tailwind CSS | 4 | config レス。shadcn スタイル UI（radix-nova、`radix-ui` 統合パッケージ、lucide-react） |
| Vitest | 4 | jsdom + Testing Library。テスト併置 |
| その他 | fflate（ZIP）、hls.js（ShowTube）、geist（フォント）、next-axiom / @vercel/analytics / @vercel/speed-insights（計測） | |

パッケージマネージャ: **npm**（package-lock.json）。Node.js 24 系（コンテナは node:24-alpine）。

## ディレクトリ構成方針

```
app/                 ページ・レイアウト・app/api/**/route.ts（メソッド別 named export）
app/generated/prisma 生成 Prisma Client（gitignore、postinstall で生成）
components/          機能別フォルダ（dashboard/ onlive/ logs/ admin/ ...）＋ ui/（shadcn プリミティブ）
hooks/               クライアント hooks（use-user-blocks, use-user-profile, use-mobile）
lib/                 サーバーヘルパー全般。SHOWROOM REST は lib/showroom/、WS 解析は lib/showroom-realtime.ts
prisma/              schema.prisma / migrations / seed.ts
types/               types/api/（リクエスト/レスポンス型）、types/pages/、types/domain/json.ts、next-auth.d.ts
test-utils/          Vitest 共有モック
scripts/             バッチ・並列開発スクリプト
docs/ (任意)         OpenAPI・画面設計メモ
ルート               auth.ts / proxy.ts / prisma.config.ts / next.config.ts / compose*.yml / Dockerfile
```

## コーディング規約

- 命名: コンポーネント PascalCase、関数/変数 camelCase、ルートフォルダ・UI ファイルは kebab-case（`components/ui/button.tsx`）
- 2 スペースインデント、named export 優先、`@/` alias でインポート
- ESLint: `eslint-config-next/core-web-vitals` + `typescript`。`no-unused-vars` は `_` プレフィックス許容（warn）
- コミット: 簡潔な命令形（例 `Add dashboard notice editor`）。PR には Prisma migration 追加・環境変数変更・実行した検証コマンドを明記
- **Server-first**: 既定は Server Component。ブラウザ API・イベントが必要な時のみ `"use client"`
- API ルートは冒頭で認可（`requireUser`/`requirePermission`/`requireTopAdminRole`）→入力検証（手書き型ガード、zod 不使用）→`lib/` 呼び出し。重要操作は `lib/audit.ts` で監査ログ
- DB アクセスは必ず `lib/prisma.ts` のシングルトン経由。複数書き込みは `$transaction`
- SHOWROOM API をコンポーネント/ルートから直接叩かない（必ず `lib/showroom/` 経由）

## 実行コマンド

```bash
npm install              # postinstall で prisma generate
npm run dev              # 開発サーバー
npm run build            # 本番ビルド（フレームワークチェック込み）
npm run start            # 本番起動
npm run lint / test / test:watch
npm run prisma:generate  # スキーマ変更後
npm run prisma:migrate   # prisma migrate deploy
npm run prisma:seed
npm run batch:backfill-log-counts   # onlive_logs counts 再計算（1回限り）

docker compose up        # DB 起動→migrate→build→start を一括（推奨。詳細は Vibe/INFRA.md）
docker compose exec app npm run prisma:seed
.\scripts\thread.ps1 start 1   # 並列開発スレッド（:3001 / DB :5501）
```

コミット前の検証シーケンス: `npm run lint && npm run test && npm run build`

## Server/Client・データ取得方針

- 全 API ルートに `export const dynamic = "force-dynamic"`、クライアント fetch は `cache: "no-store"`
- サーバーキャッシュは「ブロック ID 一覧の `unstable_cache`（60 秒、tag `user-blocks-ids-<userId>`、変更時 `revalidateTag`）」**のみ**
- SHOWROOM 呼び出しは `Promise.allSettled` で並列化し、部分失敗を `xxxHasError` フラグで UI に渡す（全体エラーにしない）
- リアルタイムはブラウザ直結の WebSocket（[API.md](./API.md) §10）、更新系はポーリング 60 秒

## 開発時の注意点・禁止事項（元実装で確立された地雷回避）

1. **時刻**: 何よりもまず [DATA_MODEL.md](./DATA_MODEL.md) §0 を読む。DB は JST 壁時計、Date は「UTC フィールドに JST を入れた」もの。`lib/jst.ts` 相当のヘルパーを最初に実装しテストで固めること。`toLocaleString()` の暗黙 TZ 依存禁止
2. **`middleware.ts` を作らない**。Next.js 16 では `proxy.ts`（`proxy` export + `config.matcher`）
3. **`next/image` を使わない**。`<img>` タグ＋必要なら eslint-disable コメント
4. Prisma Client のインポートは `@/app/generated/prisma/client`（enum は `/enums`）。`@prisma/client` から直接インポートしない
5. SHOWROOM API には UA/accept-language ヘッダー必須（欠くと応答が変わる）。プレミアムライブ・無料ギフト allowlist・30 秒ギフトマージ等のドメイン仕様は [SPEC.md](./SPEC.md) §10 を必ず維持
6. 小さな変更依頼で無関係なリファクタリング・レイアウト変更をしない
7. `updated_at` は Prisma の `@updatedAt` ではなく **DB トリガー**（migration 参照）
8. 非プレミアムのログ保存は localStorage のみ。API 側でも premium チェック（二重防御）
9. UI 文言は [SPEC.md](./SPEC.md) の日本語文言をそのまま使う（テストが文言に依存する）
10. Windows 開発を想定（PowerShell スクリプト、npm.cmd 回避策、node_modules ボリューム分離）

## 参照ドキュメント

| ファイル | 内容 |
| --- | --- |
| [Vibe/SPEC.md](./SPEC.md) | 機能仕様（画面・遷移・文言・権限・癖） |
| [Vibe/API.md](./API.md) | 全エンドポイント＋SHOWROOM 上流 API/WS プロトコル |
| [Vibe/DATA_MODEL.md](./DATA_MODEL.md) | スキーマ・migration・seed・JST 規約 |
| [Vibe/ENV.md](./ENV.md) | 環境変数（.env / compose / ビルドダミー） |
| [Vibe/INFRA.md](./INFRA.md) | compose / Dockerfile / 並列開発スレッド |
| [Vibe/DESIGN.md](./DESIGN.md) | カラー・コンポーネント・レイアウト・文言トーン |
| [Vibe/TEST_PLAN.md](./TEST_PLAN.md) | テスト基盤・観点・未カバー領域 |
| [Vibe/TASKS.md](./TASKS.md) | 実装フェーズとタスク |
| 参考: `docs/openapi.yaml`・`docs/screens/*.md` | 元リポジトリの設計メモ（bulk-download 未記載など一部実装と乖離。**Vibe/ を正とする**） |
