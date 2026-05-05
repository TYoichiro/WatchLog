# WatchLog

SHOWROOM の配信状況を追跡し、登録したルームの配信中データと終了時ログを保存する Next.js アプリケーションです。Google ログイン、招待コード制のルーム登録、配信中ダッシュボード、ログ閲覧、ユーザーブロック、管理者向け API を備えています。

## 主な機能

- Google OAuth によるログイン
- 招待コードを使った SHOWROOM ルーム登録
- 登録ルームのプロフィール、イベント、ランキング、配信状態の表示
- 配信開始検知と配信中ページへの自動遷移
- コメント、ギフト、ライブランキング、総合ランキングの配信ログ保存
- 保存済み配信ログの一覧・詳細閲覧
- SHOWROOM ユーザーのブロックとログ表示時のフィルタリング
- ロール、権限、監査ログ、メンテナンス時間、ダッシュボード告知のデータモデル

## 技術スタック

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn-style UI components
- NextAuth v5
- Prisma 7
- PostgreSQL

## 必要なもの

- Node.js 22 以上
- npm
- PostgreSQL
- Google OAuth クライアント

Google OAuth のリダイレクト URI には、開発環境なら次を登録します。

```text
http://localhost:3000/api/auth/callback/google
```

## セットアップ

依存関係をインストールします。

```bash
npm install
```

環境変数ファイルを作成します。

```bash
cp .env.local.example .env.local
```

このリポジトリには `.env.local.example` がない場合があります。その場合は `.env.local` を作成し、次の値を設定してください。

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/watchlog"
AUTH_SECRET="任意の長いランダム文字列"
AUTH_GOOGLE_ID="Google OAuth Client ID"
AUTH_GOOGLE_SECRET="Google OAuth Client Secret"
NEXTAUTH_URL="http://localhost:3000"
```

Prisma Client を生成し、DB マイグレーションとシードを実行します。

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

開発サーバーを起動します。

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 初期データと招待コード

`npm run prisma:seed` は、基本ロール、権限、ダッシュボード告知を作成します。

ルーム登録には 10 桁の招待コードが必要です。ユーザーがルームを登録すると、そのユーザーに最大 3 件の招待コードが発行され、設定画面に表示されます。初回ユーザー用の招待コードや管理者ロールは、現状では DB に直接投入するか、運用用スクリプトを追加して用意してください。

## 環境変数

| 変数名 | 必須 | 内容 |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL 接続文字列 |
| `AUTH_SECRET` | Yes | NextAuth の署名シークレット |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth Client Secret |
| `NEXTAUTH_URL` | Yes | アプリケーションのベース URL |

## npm scripts

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Next.js 開発サーバーを起動 |
| `npm run build` | 本番ビルドを作成 |
| `npm run start` | 本番ビルドを起動 |
| `npm run lint` | ESLint を実行 |
| `npm run prisma:generate` | Prisma Client を生成 |
| `npm run prisma:migrate` | Prisma migration を適用 |
| `npm run prisma:seed` | シードデータを投入 |

## ディレクトリ構成

```text
app/          Next.js App Router のページ、レイアウト、API routes
components/   再利用可能な React コンポーネント
hooks/        クライアント hooks
lib/          サーバーヘルパー、SHOWROOM 連携、認可、DB アクセス
prisma/       Prisma schema、migrations、seed
public/       静的ファイル
types/        共有 TypeScript 型
```

## 開発時の確認

変更後は少なくとも次を実行してください。

```bash
npm run lint
npm run build
```

Prisma schema を変更した場合は、`npm run prisma:generate` と migration の追加・適用も行います。

## ライセンス

[LICENSE](./LICENSE) を参照してください。
