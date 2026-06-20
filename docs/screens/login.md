# ログイン画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/` |
| レンダリング | Server Component (SSR) |
| 認証要否 | 不要（未認証ユーザー向け） |
| ページタイトル | WatchLog |

ユーザーが WatchLog にログインするための入口画面です。Google OAuth を使用したソーシャルログインのみ対応しています。

---

## アクセス制御

| 条件 | 動作 |
|------|------|
| セッションあり かつ BAN済み | `/banned` へリダイレクト |
| セッションあり かつ 登録ルームあり | `/dashboard` へリダイレクト |
| セッションあり かつ 登録ルームなし | `/search` へリダイレクト |
| 未ログイン | ログイン画面を表示 |

---

## 画面レイアウト

```
┌────────────────────────────────────┐
│                                    │
│           WatchLog（テキスト h1）    │
│                                    │
│  ┌──────────────────────────────┐  │
│  │       [Google でログイン]     │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │         お知らせカード        │  │
│  │  ─────────────────────────   │  │
│  │  通知タイトル       yyyy/MM/dd│  │
│  │  通知本文                     │  │
│  └──────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘
```

---

## コンポーネント構成

### ページ

- **ファイル**: [app/page.tsx](../app/page.tsx)
- **種別**: Server Component (async)

**処理フロー**:
1. `auth()` でセッション確認
2. ユーザーIDがあれば `prisma.user.findUnique` で BAN 状態を確認 → BAN済みなら `/banned` へリダイレクト
3. `getUserRegisteredRoom(userId)` で登録ルームを確認 → 登録ルーム有無に応じて `/dashboard` または `/search` へリダイレクト
4. `getLoginNotices()` でログイン画面向けお知らせを取得
5. `<LoginScreen>` に props を渡してレンダリング

### LoginScreen

- **ファイル**: [components/login/login-screen.tsx](../components/login/login-screen.tsx)
- **種別**: Server Component

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `loginNotices` | `AppNotice[]` | 表示するお知らせ一覧 |
| `hasNoticesError` | `boolean` | お知らせ取得失敗フラグ |
| `signInWithGoogle` | `NonNullable<ComponentProps<"form">["action"]>` | Google ログイン Server Action |

**スタイリング**:
- 背景: `bg-slate-100`
- カード: `rounded-3xl` でカード形式

### NoticeListCard

- **ファイル**: [components/notices/notice-list-card.tsx](../components/notices/notice-list-card.tsx)
- **種別**: Client Component

お知らせの一覧を表示するカードコンポーネント。

| 状態 | 表示内容 |
|------|---------|
| 読み込み中 | ローディングインジケーター |
| 取得エラー | エラーメッセージ |
| 通知あり | 通知タイトル・日付・本文・リンク |
| 通知なし | 空メッセージ |

---

## ログインボタン

### Google ログイン

- **方式**: HTML `<form>` の `action` 属性に Server Action を設定
- **実装**: POST リクエストで NextAuth のサインインフローを開始
- **アイコン**: Google ロゴ (inline SVG)

---

## 認証フロー

```
ユーザー
  │
  ▼ [Google でログイン] クリック
Server Action (signInWithGoogle)
  │
  ▼ NextAuth signIn("google")
Google OAuth 認可ページ
  │
  ▼ 認可完了・コールバック
/api/auth/[...nextauth]
  │
  ▼ PrismaAdapter でセッション保存
  │
  ├─ 新規ユーザーの場合: createUser callback
  │     ├─ UserRole "user" を自動付与
  │     └─ auditLog 記録 (auth.user.create)
  │
  ├─ signIn callback: auditLog 記録 (auth.sign_in)
  │
  ▼ セッション確立
/ (ルートページ) で再評価 → /dashboard or /search へリダイレクト
```

---

## API・認証設定

### NextAuth 設定

- **ファイル**: [auth.ts](../auth.ts)
- **アダプター**: `PrismaAdapter`
- **セッション戦略**: `database`
- **プロバイダー**: Google OAuth のみ

### API ルート

- **ファイル**: [app/api/auth/[...nextauth]/route.ts](../app/api/auth/[...nextauth]/route.ts)
- **エンドポイント**: `GET|POST /api/auth/*`
- NextAuth の標準ハンドラーをそのまま公開

---

## お知らせ取得

- **関数**: `getLoginNotices()` ([lib/dashboard-notices.ts](../lib/dashboard-notices.ts))
- **内部実装**: `getNotices("login")` を呼び出す
- **取得条件**:
  - `displayTarget: LOGIN または ALL`
  - `publishedAt <= 現在JST時刻`
  - `expiresAt is null OR expiresAt > 現在JST時刻`
- **ソート**: `publishedAt DESC`, `createdAt DESC`

**AppNotice 型**:

```typescript
type AppNotice = {
  id: number;
  title: string;
  date: string;       // JST フォーマット済み文字列
  body: string;
  linkUrl: string | null;
};
```

---

## 環境変数

| 変数名 | 用途 |
|--------|------|
| `AUTH_SECRET` | NextAuth 署名・暗号化キー |
| `AUTH_GOOGLE_ID` | Google OAuth クライアント ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth シークレット |
| `NEXTAUTH_URL` | NextAuth コールバックのベース URL |
| `DATABASE_URL` | セッション・ユーザーデータの保存先 DB |

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/page.tsx](../app/page.tsx) | ページコンポーネント（リダイレクト制御・データ取得） |
| [components/login/login-screen.tsx](../components/login/login-screen.tsx) | ログイン画面 UI |
| [components/notices/notice-list-card.tsx](../components/notices/notice-list-card.tsx) | お知らせカード |
| [auth.ts](../auth.ts) | NextAuth 設定・コールバック |
| [app/api/auth/[...nextauth]/route.ts](../app/api/auth/[...nextauth]/route.ts) | NextAuth API ハンドラー |
| [lib/dashboard-notices.ts](../lib/dashboard-notices.ts) | お知らせデータ取得 |
| [lib/user-registered-room.ts](../lib/user-registered-room.ts) | 登録ルーム確認 |
| [lib/audit.ts](../lib/audit.ts) | 監査ログ記録 |
