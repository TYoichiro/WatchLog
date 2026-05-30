# 管理者ユーザー管理画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/admin/users` |
| レンダリング | Server Component（ページ）+ Client Component（UI） |
| 認証要否 | 必要 |
| 権限要否 | `admin` ロール（不足時は `/dashboard` へリダイレクト） |
| ページタイトル | `ユーザー一覧 \| WatchLog` |

すべてのユーザーを一覧表示し、BAN / アンバン操作を行う管理者専用画面です。ユーザーのアバター・名前・メールアドレス・登録ルーム・作成日時・ロール・BAN 状態を確認できます。

---

## アクセス制御

| 条件 | 動作 |
|------|------|
| 未ログイン | `/` へリダイレクト |
| `admin` ロールなし | `/dashboard` へリダイレクト |
| `admin` ロールあり | ユーザー一覧を表示 |

---

## 画面レイアウト

```
┌────────────────────────────────────────────────────────────────┐
│ [サイドバー]  ユーザー一覧 N件                                    │
│              ⚠ N件のBANユーザーがいます（BANユーザーがいる場合）  │
│              ┌──────────────────────────────────────────────┐  │
│              │ [アバター]  名前 [自分] [管理者] [BAN]         │  │
│              │             メール / ルーム名 / 作成日時       │  │
│              │                               [操作不可]     │  │
│              ├──────────────────────────────────────────────┤  │
│              │ [アバター]  名前                               │  │
│              │             メール / ルーム名 / 作成日時       │  │
│              │                      [許可▼]  or [BAN▼]     │  │
│              └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## コンポーネント構成

### ページ

- **ファイル**: [app/admin/users/page.tsx](../app/admin/users/page.tsx)
- **種別**: Server Component (async)
- **キャッシュ制御**: `force-dynamic`
- **AppShell**: `activeKey="admin-users"`, `isAdmin=true`

**処理フロー**:
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `hasTopAdminRole(userId)` で管理者判定、非管理者なら `/dashboard` へリダイレクト
3. `prisma.user.findMany` で全ユーザーを `createdAt DESC` で取得
4. `toJstWallTimeIsoString` で `createdAt` を JST ISO 文字列に変換
5. `<UserListPage users={userItems} currentUserId={userId}>` をレンダリング

**取得フィールド**:
- `id`, `name`, `email`, `image`, `isBanned`, `createdAt`
- `userRoles.role.name`（ロール名）
- `registeredRoom.roomId`, `registeredRoom.roomUrl`, `registeredRoom.roomName`

### UserListPage

- **ファイル**: [components/admin/user-list-page.tsx](../components/admin/user-list-page.tsx)
- **種別**: Client Component (`"use client"`)

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `users` | `UserListItem[]` | ユーザー一覧 |
| `currentUserId` | `string` | ログイン中の自分のユーザーID |

**型定義（UserListItem）**:

```typescript
type UserListItem = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isBanned: boolean;
  createdAt: string;        // JST ISO 文字列
  roles: { name: string }[];
  registeredRoom: {
    roomId: string;
    roomUrl: string;
    roomName: string | null;
  } | null;
};
```

### 各ユーザー行

| 要素 | 説明 |
|------|------|
| アバター画像 | `image` がある場合は `<img>` で表示（`sm` 以上でのみ表示） |
| アバター非表示時 | UserIcon を代替表示 |
| 名前 | `name ?? "（名前未設定）"` |
| 自分バッジ | `id === currentUserId` のとき青の「自分」バッジ |
| 管理者バッジ | `roles` に `admin` が含まれるとき amber の「管理者」バッジ |
| BANバッジ | `isBanned = true` のとき赤の「BAN」バッジ |
| メールアドレス | `email ?? "（メール未設定）"` |
| 登録ルーム | `Tv` アイコン + ルーム名（未登録なら「未登録」をグレー表示） |
| 作成日時 | `formatDate(createdAt)` — `YYYY/MM/DD HH:mm` 形式（JST） |

### BANステータスセレクト（`BanSelect`）

各ユーザー行の右端に表示するドロップダウン。

**表示条件**:

| 条件 | 表示 |
|------|------|
| `isSelf = true`（自分） | 「操作不可」のテキスト（セレクトなし） |
| `isAdmin = true`（管理者ユーザー） | 「管理者」のテキスト（セレクトなし） |
| 上記以外 | `<select>` で BAN / 許可 を切り替え |

**セレクト状態**:

| `status` | 選択肢 | スタイル |
|---------|--------|---------|
| `"allowed"` | 「許可」が選択中 | 通常（`text-slate-700`） |
| `"banned"` | 「BAN」が選択中 | 赤色（`data-banned=true` → `border-red-200 text-red-700`） |

**変更時の処理**:
1. `PATCH /api/admin/users/{userId}/ban` に `{ banned: boolean }` を送信
2. 成功時: `status` を更新
3. 失敗時: 「変更に失敗しました」をエラー表示（赤文字）
4. 処理中: セレクトを `disabled`

---

## BAN カウント表示

`users.filter(u => u.isBanned).length > 0` の場合、ヘッダーに BAN ユーザー数を表示します。

```
⚠ {bannedCount}件のBANユーザーがいます
```

（`ShieldAlert` アイコン + 赤文字）

---

## API エンドポイント

### PATCH /api/admin/users/{userId}/ban

- **ファイル**: [app/api/admin/users/[userId]/ban/route.ts](../app/api/admin/users/%5BuserId%5D/ban/route.ts)
- **認証・権限**: `requireTopAdminRole()` — 管理者のみ

**リクエストボディ**:

```json
{ "banned": true }
```

**内部処理（トランザクション）**:
1. 対象ユーザーの存在確認（存在しなければ 404）
2. 自分自身への操作を禁止（400）
3. 管理者ユーザーへの BAN を禁止（403）
4. `user.isBanned` を更新
5. `banned: false`（アンバン）の場合、`user.inviteCodeFailureCount` を 0 にリセット
6. `banned: true` の場合、対象ユーザーの全セッションを削除（即時ログアウト）
7. 監査ログ記録（`user.ban` または `user.unban`）

**レスポンス（200）**:

```json
{ "banned": true }
```

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 400 | リクエストボディが無効 |
| 400 | 自分自身を BAN しようとした |
| 401 | 未認証 |
| 403 | 管理者ロールなし |
| 403 | 管理者ユーザーを BAN しようとした |
| 404 | 対象ユーザーが存在しない |
| 500 | DB エラー |

---

## データモデル

### User.isBanned / User.inviteCodeFailureCount

```prisma
model User {
  id                     String  @id @default(cuid())
  isBanned               Boolean @default(false) @map("is_banned")
  inviteCodeFailureCount Int     @default(0) @map("invite_code_failure_count")
  ...
}
```

`inviteCodeFailureCount` は招待コード検証の失敗回数をサーバー側で管理するフィールドです。3回失敗すると自動 BAN が発動し、管理者によるアンバン時に 0 にリセットされます。

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/admin/users/page.tsx](../app/admin/users/page.tsx) | ページ（認証・データ取得・レンダリング） |
| [components/admin/user-list-page.tsx](../components/admin/user-list-page.tsx) | ユーザー一覧 UI・BAN 操作 |
| [app/api/admin/users/[userId]/ban/route.ts](../app/api/admin/users/%5BuserId%5D/ban/route.ts) | BAN/アンバン API |
| [lib/authz.ts](../lib/authz.ts) | 管理者権限判定 |
| [lib/audit.ts](../lib/audit.ts) | 監査ログ記録 |
| [lib/jst.ts](../lib/jst.ts) | JST 日時変換 |
| [prisma/schema.prisma](../../prisma/schema.prisma) | `User` モデル（`isBanned` フィールド） |
