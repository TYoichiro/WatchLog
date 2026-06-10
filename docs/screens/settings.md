# 設定画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/settings` |
| レンダリング | Server Component (SSR, `force-dynamic`) |
| 認証要否 | 必要 |
| ページタイトル | 設定 \| WatchLog |

ユーザーが自分のアカウント情報を確認できる画面です。現在の権限ロールと招待コードを参照できます。

---

## アクセス制御

| 条件 | 動作 |
|------|------|
| 未ログイン | `/` へリダイレクト |
| ログイン済み かつ 登録ルームなし | `/search` へリダイレクト |
| ログイン済み かつ 登録ルームあり | 設定画面を表示 |

---

## 画面レイアウト

```
┌────────────────────────────────────────────────────────────┐
│  [サイドバー]   設定                                        │
│  ・ホーム      ─────────────────────────────────────────  │
│  ・ログ閲覧    ┌──────────────────────────────────────┐   │
│  ・ブロック    │ 🛡 権限                                │   │
│  ・設定 ◀━━   │ あなたは管理者ユーザーです            │   │
│               └──────────────────────────────────────┘   │
│               ┌──────────────────────────────────────┐   │
│               │ 🔑 招待コード（最大3名まで招待可）     │   │
│               │ ──────────────────────────────────── │   │
│               │ XXXXXXXXXX              [有効]        │   │
│               │ ──────────────────────────────────── │   │
│               │ YYYYYYYYYY              [有効]        │   │
│               │ ──────────────────────────────────── │   │
│               │ ZZZZZZZZZZ              [無効]        │   │
│               └──────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

## コンポーネント構成

### ページ

- **ファイル**: [app/settings/page.tsx](../app/settings/page.tsx)
- **種別**: Server Component (async)
- **キャッシュ制御**: `export const dynamic = "force-dynamic"`（毎リクエストで最新データを取得）

**処理フロー**:
1. `auth()` でセッション確認 → ユーザーIDがなければ `/` へリダイレクト
2. `getUserRegisteredRoom`, `listUserInvitationCodes`, `hasTopAdminRole`, `hasPremiumRole` を `Promise.all` で並列取得
3. 登録ルームがなければ `/search` へリダイレクト
4. `getRoleLabel(isAdmin, isPremium)` で表示ロールラベルを決定
5. 招待コードカードの見出し（`invitationHeading`）を生成:
   - 管理者の場合: `招待コード（現在{activeCount}名招待できるコードがあります　未利用：{activeCount}件　使用済み：{usedCount}件）`
   - 一般ユーザーの場合: `招待コード（最大3名まで招待することができます）`
6. `<AppShell activeKey="settings" isAdmin={isAdmin} isPremium={isPremium}>` 内に権限カード・招待コードカードをレンダリング

**ロールラベル決定ロジック（`getRoleLabel`）**:

| 条件 | 表示ラベル |
|------|-----------|
| `isAdmin = true` | 管理者 |
| `isAdmin = false` かつ `isPremium = true` | プレミアム |
| `isAdmin = false` かつ `isPremium = false` | 一般 |

管理者とプレミアムの両方を持つユーザーは「管理者」と表示されます。

### AppShell

- **ファイル**: [components/navigation/app-sidebar.tsx](../components/navigation/app-sidebar.tsx)
- **種別**: Client Component
- **activeKey**: `"settings"`（サイドバーの設定項目をハイライト）

アプリ全体のナビゲーションシェル。デスクトップ（xl 以上）ではサイドバー、モバイルではハンバーガーメニューを表示。

**ナビゲーション項目**:

| key | ラベル | URL |
|-----|--------|-----|
| `dashboard` | ホーム | `/dashboard` |
| `logs` | ログ閲覧 | `/logs` |
| `block` | ブロック | `/block` |
| `settings` | 設定 | `/settings` |

ログアウトは `signOut({ redirectTo: "/" })` を実行してトップページへリダイレクト。

---

## 権限カード

| 要素 | 説明 |
|------|------|
| アイコン + 見出し | ShieldCheck アイコン + 「権限」の h2 見出し |
| 説明文 | 「あなたは**{ロールラベル}**ユーザーです」（ロールラベル部分は太字） |

### ロールラベル一覧

| ラベル | 対象ユーザー |
|--------|-------------|
| 管理者 | `hasTopAdminRole(userId) = true` のユーザー |
| プレミアム | `hasPremiumRole(userId) = true`（かつ管理者でない）のユーザー |
| 一般 | 上記いずれにも該当しないユーザー |

---

## 招待コードカード

- **ファイル**: [components/settings/invitation-code-card.tsx](../components/settings/invitation-code-card.tsx)
- **種別**: Server Component

### カード構成

| 要素 | 説明 |
|------|------|
| アイコン + 見出し | KeyRound アイコン + `heading` prop の h2 見出し |
| 招待コード生成ボタン | 管理者（`isAdmin = true`）の場合のみ、見出し右端に `GenerateInvitationCodeButton` を表示 |
| コード一覧 | `divide-y` で区切り線付きリスト |

### GenerateInvitationCodeButton

- **ファイル**: [components/settings/generate-invitation-code-button.tsx](../components/settings/generate-invitation-code-button.tsx)
- **種別**: Client Component (`"use client"`)
- **表示条件**: 管理者のみ

| 要素 | 説明 |
|------|------|
| ボタン | Plus アイコン + 「招待コード生成」ラベル（outline, sm） |
| 生成中 | `isPending = true` でボタンを `disabled` |
| エラー時 | 赤文字でエラーメッセージを表示 |

**クリック時の処理**:
1. `POST /api/invitations` を呼び出す
2. 成功時: `router.refresh()` でページを再取得
3. 失敗時: エラーメッセージを表示

### 各コード行

| 要素 | 説明 |
|------|------|
| コード文字列 | `font-mono` で表示（例: `ABCD123456`） |
| ステータスバッジ | 有効 / 無効を色分け表示 |

### ステータスバッジ

| 状態 | 条件 | ラベル | スタイル |
|------|------|--------|---------|
| 有効 | `!isDeleted && usedAt === null` | 有効 | `border-emerald-200 bg-emerald-50 text-emerald-700`（緑系） |
| 無効 | `isDeleted || usedAt !== null` | 無効 | `border-slate-200 bg-slate-50 text-slate-500`（グレー系） |

### 空状態

招待コードが1件もない場合は「招待コードはありません」を表示。

---

## データ取得

### 登録ルーム確認

- **関数**: `getUserRegisteredRoom(userId)` ([lib/user-registered-room.ts](../lib/user-registered-room.ts))
- **用途**: アクセス制御（登録ルームの有無確認）

**返却型**:

```typescript
type UserRegisteredRoomData = {
  imageUrl: string | null;
  roomId: string;
  roomName: string | null;
  roomUrl: string;
};
```

### 招待コード一覧取得

- **関数**: `listUserInvitationCodes(userId)` ([lib/invitations.ts](../lib/invitations.ts))
- **ソート**: `createdAt` 昇順
- **最大件数**: 3件（`USER_INVITATION_CODE_LIMIT = 3`）

**返却型**:

```typescript
type UserInvitationCodeData = {
  code: string;      // 10文字の英数字
  isActive: boolean; // !isDeleted && usedAt === null
};
```

**クエリ条件**:
```
WHERE inviterUserId = :userId
ORDER BY createdAt ASC
SELECT code, isDeleted, usedAt
```

### 権限判定

- **関数**: `hasTopAdminRole(userId)` / `hasPremiumRole(userId)` ([lib/authz.ts](../lib/authz.ts))
- **用途**: 表示するロールラベルの決定
- `getUserRegisteredRoom`・`listUserInvitationCodes` と同じ `Promise.all` で並列取得

| 関数 | ロール名 | 説明 |
|------|---------|------|
| `hasTopAdminRole` | `admin` | 管理者ロール保持確認 |
| `hasPremiumRole` | `premiumuser` | プレミアムロール保持確認 |

---

## API エンドポイント

### POST /api/invitations

- **ファイル**: [app/api/invitations/route.ts](../app/api/invitations/route.ts)
- **認証**: 必要
- **利用者**: 管理者のみ（`GenerateInvitationCodeButton` から呼び出し）

招待コードを手動生成します。管理者が追加の招待コードを発行する際に使用します。

**レスポンス（201）**:

```json
{
  "code": "XXXXXXXXXX"
}
```

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 401 | 未認証 |

---

## 招待コードの仕組み

招待コードはルーム登録時に自動生成されます（`PUT /api/registered-room` のトランザクション内）。管理者は `POST /api/invitations` を使って追加コードを手動生成することもできます。

| 定数 | 値 | 説明 |
|------|----|------|
| `INVITATION_CODE_LENGTH` | 10 | コードの文字数 |
| `USER_INVITATION_CODE_LIMIT` | 3 | ユーザーあたりの最大コード数 |

**コードの状態遷移**:

```
生成（isDeleted=false, usedAt=null）
  │
  ├─ 他ユーザーが使用 → usedAt が設定される（使用済み）
  └─ 削除 → isDeleted=true（無効）
```

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/settings/page.tsx](../app/settings/page.tsx) | ページコンポーネント（データ取得・レンダリング） |
| [components/navigation/app-sidebar.tsx](../components/navigation/app-sidebar.tsx) | AppShell・ナビゲーションサイドバー |
| [lib/authz.ts](../lib/authz.ts) | 管理者・プレミアム権限判定（`hasTopAdminRole`, `hasPremiumRole`） |
| [lib/user-registered-room.ts](../lib/user-registered-room.ts) | 登録ルームデータ取得 |
| [lib/invitations.ts](../lib/invitations.ts) | 招待コード管理ロジック |
| [components/settings/invitation-code-card.tsx](../components/settings/invitation-code-card.tsx) | 招待コードカード |
| [components/settings/generate-invitation-code-button.tsx](../components/settings/generate-invitation-code-button.tsx) | 招待コード生成ボタン（管理者専用） |
| [components/settings/role-card.tsx](../components/settings/role-card.tsx) | 権限カード |
| [app/api/invitations/route.ts](../app/api/invitations/route.ts) | 招待コード生成 API |
| [components/ui/card.tsx](../components/ui/card.tsx) | Card UI コンポーネント |
| [components/ui/badge.tsx](../components/ui/badge.tsx) | Badge UI コンポーネント |
