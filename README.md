# WatchLog

WatchLog は SHOWROOM の配信状況を追跡し、配信中のコメント・ギフト・ランキング・ルーム情報を閲覧、保存できる Next.js アプリケーションです。Google ログイン、招待コード制のルーム登録、配信ログ保存、ユーザーブロック、管理者向けのユーザー・ルーム・お知らせ・メンテナンス管理を備えています。

## 主な機能

- Google OAuth によるログインと DB セッション管理
- 招待コードを使った SHOWROOM ルーム登録（同一ルームの重複登録チェック付き）
- 招待コード入力失敗 3 回によるユーザーの自動 BAN
- 登録ルームのプロフィール、イベント、ファン情報、配信状態のダッシュボード表示
- SHOWROOM WebSocket による配信開始検知と配信中ページへの自動遷移
- 配信中のコメント、テロップ、ギフト、ライブランキング、総合ランキング、指標の閲覧（プレミアムライブ対応）
- 配信終了時のログ保存、JSON ダウンロード、JSON インポート閲覧
- ログのタイトル編集、お気に入り、削除、ページング
- SHOWROOM ユーザーのブロックと、コメント・ギフト・ランキング表示へのフィルタ適用
- `premiumuser` または `admin` 向けの ShowTube 機能（プレミアムライブ視聴対応）
- `admin` 向けのユーザー、登録ルーム、お知らせ、メンテナンス、BAN 管理、期限切れセッション削除
- API リクエストログ、監査ログ、アプリケーションログ出力

## 技術スタック

- Next.js 16.2.4 App Router
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- shadcn-style UI components / Radix UI / lucide-react
- NextAuth v5 beta
- Prisma 7.8.0 / `@prisma/adapter-pg`
- PostgreSQL
- Vitest 4 / Testing Library / jsdom
- hls.js

Prisma Client は `prisma/schema.prisma` の generator 設定により `app/generated/prisma` に生成されます。

## 必要なもの

### Docker Compose で起動する場合

- Docker & Docker Compose
- Google OAuth クライアント

### ローカルで直接起動する場合

- Node.js 24 系推奨
- npm
- PostgreSQL
- Google OAuth クライアント

Google OAuth のリダイレクト URI には、ローカル開発では次を登録してください。

```text
http://localhost:3000/api/auth/callback/google
```

## セットアップ

### Docker Compose（推奨）

`.env` を作成し、認証情報を設定します。`DATABASE_URL` は compose.yml が自動で上書きするため任意の値で構いません。

```env
DATABASE_URL="postgresql://watchlog:watchlog@localhost:5432/watchlog"
AUTH_SECRET="your-long-random-secret"
AUTH_GOOGLE_ID="Google OAuth Client ID"
AUTH_GOOGLE_SECRET="Google OAuth Client Secret"
NEXTAUTH_URL="http://localhost:3000"
```

1 コマンドで PostgreSQL の起動・マイグレーション適用・開発サーバーの起動をすべて行います。

```bash
docker compose up
```

初回は `npm ci` が走るため数分かかります。2 回目以降は `node_modules` がキャッシュされるため高速に起動します。

初期データが必要な場合は別ターミナルで実行してください。

```bash
docker compose exec app npm run prisma:seed
```

ブラウザで `http://localhost:3000` を開きます。

### ローカル直接起動

`.env` を作成し、環境変数を設定します。

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/watchlog"
AUTH_SECRET="your-long-random-secret"
AUTH_GOOGLE_ID="Google OAuth Client ID"
AUTH_GOOGLE_SECRET="Google OAuth Client Secret"
NEXTAUTH_URL="http://localhost:3000"
```

依存関係をインストールし、マイグレーションを適用して初期データを投入します。

```bash
npm install
npm run prisma:migrate
npm run prisma:seed
```

開発サーバーを起動します。

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 環境変数

| 変数名 | 必須 | 内容 |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL 接続文字列 |
| `AUTH_SECRET` | Yes | NextAuth の署名用シークレット |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth Client Secret |
| `NEXTAUTH_URL` | Yes | アプリケーションのベース URL |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error`。未設定時は開発環境で `debug`、本番環境で `info` |

ログは `logs/YYYY-MM-DD.log` に JSON Lines 形式で出力されます。

## 初期データとロール

`npm run prisma:seed` は次の初期データを作成します。

- ロール: `admin`、`user`、`premiumuser`
- 権限: `profile.read`、`user.read`、`user.update`、`role.assign`、`audit.read`
- ダッシュボード・ログイン画面向けのお知らせ

新規ログインユーザーには `user` ロールが付与されます。ルーム登録時に招待コードを消費し、そのユーザー用に最大 3 件の招待コードが補充されます。招待コードの入力失敗が 3 回に達したユーザーは自動的に BAN されます。`admin` ロールは API から付与できないため、必要に応じて DB に直接設定してください。

## npm scripts

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Next.js 開発サーバーを起動 |
| `npm run build` | 本番ビルドを作成 |
| `npm run start` | 本番ビルドを起動 |
| `npm run lint` | ESLint を実行 |
| `npm run test` | Vitest を 1 回実行 |
| `npm run test:watch` | Vitest を watch モードで起動 |
| `npm run prisma:generate` | Prisma Client を生成 |
| `npm run prisma:migrate` | `prisma migrate deploy` で既存マイグレーションを適用 |
| `npm run prisma:seed` | 初期データを投入 |

PowerShell の実行ポリシーで `npm` がブロックされる環境では、`npm.cmd run dev` のように `npm.cmd` を使ってください。

## 主要ルート

| ルート | 内容 |
| --- | --- |
| `/` | ログイン画面。ログイン済みなら登録状況に応じて `/dashboard` または `/search` へ遷移 |
| `/search` | SHOWROOM ルーム検索と招待コードによるルーム登録 |
| `/dashboard` | 登録ルームの状態、イベント、ファン情報、お知らせを表示 |
| `/onlive` | 配信中ビュー。コメント、ギフト、ランキング、指標をリアルタイム表示 |
| `/logs` | 保存済み配信ログ一覧、JSON ダウンロード、JSON インポート |
| `/logs/[logId]` | DB 保存ログの詳細 |
| `/logs/local/[roomId]` | ローカル保存ログの詳細 |
| `/logs/json-import` | インポートした JSON ログの閲覧 |
| `/block` | SHOWROOM ユーザーブロック一覧 |
| `/settings` | ロール表示と招待コード一覧 |
| `/showtube` | 現在配信中のルーム一覧。`admin` / `premiumuser` 向け |
| `/showtube/watch` | HLS 視聴ページ。`admin` / `premiumuser` 向け |
| `/admin/users` | ユーザー一覧、プレミアム切替、BAN 管理、期限切れセッション削除 |
| `/admin/rooms` | 登録ルーム一覧 |
| `/admin/notices` | お知らせ管理 |
| `/admin/maintenance` | メンテナンス時間管理 |
| `/maintenance` | 有効なメンテナンス時間中に表示 |
| `/banned` | BAN 済みユーザー向け遷移先 |

## ディレクトリ構成

```text
app/          Next.js App Router のページ、レイアウト、API routes、生成 Prisma Client
components/   再利用可能な React コンポーネント
components/ui shadcn-style の UI プリミティブ
hooks/        クライアント hooks
lib/          サーバーヘルパー、認可、DB、SHOWROOM 連携、ログ処理
prisma/       Prisma schema、migrations、seed
docs/         OpenAPI 定義と画面設計メモ
public/       静的ファイル
test-utils/   Vitest 用モック
types/        共有 TypeScript 型
```

## 開発時の確認

変更後は影響範囲に応じて次を実行してください。

```bash
npm run lint
npm run test
npm run build
```

Prisma schema を変更した場合は `npm run prisma:generate` を実行し、必要に応じて migration を追加してください。

## Docker Compose 構成

`compose.yml` は次の 2 サービスで構成されています。

| サービス | 内容 |
| --- | --- |
| `db` | PostgreSQL 16。データは `postgres_data` ボリュームに永続化 |
| `app` | `node:24-alpine` イメージでソースをマウント。起動時に `npm ci → prisma migrate deploy → npm run dev` を実行 |

`node_modules` は名前付きボリューム（`node_modules`）に格納するため、Windows ホストのバイナリと Linux コンテナのバイナリが混在しません。`DATABASE_URL` は `compose.yml` の `environment:` で上書きされるため、`.env` 内の値は compose 起動時には参照されません。

## ライセンス

[LICENSE](./LICENSE) を参照してください。
