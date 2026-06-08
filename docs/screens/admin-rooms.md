# 管理者ルーム管理画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/admin/rooms` |
| レンダリング | Server Component（ページ）+ Client Component（UI） |
| 認証要否 | 必要 |
| 権限要否 | `admin` ロール（不足時は `/dashboard` へリダイレクト） |
| ページタイトル | `ルーム一覧 \| WatchLog` |

登録済みのすべてのルームを一覧表示し、ユーザーのプレミアムロールを管理する管理者専用画面です。

---

## アクセス制御

| 条件 | 動作 |
|------|------|
| 未ログイン | `/` へリダイレクト |
| `admin` ロールなし | `/dashboard` へリダイレクト |
| `admin` ロールあり | ルーム一覧を表示 |

---

## 画面レイアウト

```
┌────────────────────────────────────────────────────────────────┐
│ [サイドバー]  ルーム一覧 N件                                      │
│              ┌──────────────────────────────────────────────┐  │
│              │ [サムネイル]  ルーム名                         │  │
│              │              ルームID / ユーザー名 / 作成日時  │  │
│              │                   [ロール▼] [プロフィール] [配信ページ] │  │
│              ├──────────────────────────────────────────────┤  │
│              │ （管理者ユーザーのルームはロール変更なし）       │  │
│              │              ルームID / ユーザー名 / 作成日時  │  │
│              │                          [プロフィール] [配信ページ] │  │
│              └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## コンポーネント構成

### ページ

- **ファイル**: [app/admin/rooms/page.tsx](../app/admin/rooms/page.tsx)
- **種別**: Server Component (async)
- **キャッシュ制御**: `force-dynamic`
- **AppShell**: `activeKey="admin-rooms"`, `isAdmin=true`

**処理フロー**:
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `hasTopAdminRole(userId)` で管理者判定、非管理者なら `/dashboard` へリダイレクト
3. `listAllRegisteredRooms()` で全登録ルームを `createdAt DESC` で取得
4. `toJstWallTimeIsoString` で `createdAt` を JST ISO 文字列に変換
5. `<RoomListPage rooms={roomItems}>` をレンダリング

### RoomListPage

- **ファイル**: [components/admin/room-list-page.tsx](../components/admin/room-list-page.tsx)
- **種別**: Client Component (`"use client"`)

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `rooms` | `RoomListItem[]` | ルーム一覧 |

**型定義（RoomListItem）**:

```typescript
type RoomListItem = {
  id: string;
  roomId: string;
  roomUrl: string;
  roomName: string | null;
  imageUrl: string | null;
  createdAt: string;        // JST ISO 文字列
  user: {
    id: string;
    name: string | null;
    isPremium: boolean;
    isAdmin: boolean;
  };
};
```

### 各ルーム行

| 要素 | 説明 |
|------|------|
| サムネイル画像 | `imageUrl` がある場合は `<img>` で表示（`sm` 以上でのみ表示、`80×56px`） |
| ルーム名 | `roomName ?? roomUrl` |
| ルームID | `Hash` アイコン + `roomId` |
| ユーザー名 | `User` アイコン + `user.name ?? "（名前未設定）"` |
| 作成日時 | `formatDate(createdAt)` — `YYYY/MM/DD HH:mm` 形式（JST） |
| ロール変更 | `user.isAdmin = false` のとき `<RoleSelect>` を表示 |
| プロフィールリンク | SHOWROOM プロフィールページ（`https://www.showroom-live.com/room/profile?room_id={roomId}`）を新規タブで開く |
| 配信ページリンク | SHOWROOM 配信ページ（`https://www.showroom-live.com/r/{roomUrl}`）を新規タブで開く |

### ロールセレクト（`RoleSelect`）

各ルーム行に表示するロール変更ドロップダウン。管理者ユーザー（`user.isAdmin = true`）の行には表示しない。

**選択肢**:

| value | 表示ラベル |
|-------|----------|
| `"general"` | 一般ユーザー |
| `"premiumuser"` | プレミアムユーザー |

**変更時の処理**:
1. `PATCH /api/admin/users/{userId}/role` に `{ role: "premiumuser" | "general" }` を送信
2. 成功時: `role` 状態を更新
3. 失敗時: 「変更に失敗しました」をエラー表示（赤文字）
4. 処理中: セレクトを `disabled`

---

## API エンドポイント

### PATCH /api/admin/users/{userId}/role

- **ファイル**: [app/api/admin/users/[userId]/role/route.ts](../app/api/admin/users/%5BuserId%5D/role/route.ts)
- **認証・権限**: `requirePermission("role.assign")`

**リクエストボディ**:

```json
{ "role": "premiumuser" }
```

**内部処理**:
1. 対象ユーザーの存在確認（存在しなければ 404）— トランザクション外
2. トランザクション内:
   - `role = "premiumuser"` のとき:
     - `UserRole` に `premiumuser` ロールを upsert
     - 監査ログ記録（`role.assign`）
   - `role = "general"` のとき:
     - `UserRole` から `premiumuser` ロールを deleteMany（`admin` ロールは対象外）
     - 削除件数 > 0 の場合、監査ログ記録（`role.remove`）

**レスポンス（200）**:

```json
{ "role": "premiumuser" }
```

または

```json
{ "role": "general" }
```

（リクエストで指定した `role` の値をそのまま返す）

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 400 | リクエストボディが無効 |
| 401 | 未認証 |
| 403 | `role.assign` 権限なし |
| 404 | 対象ユーザーが存在しない |
| 500 | DB エラー |

---

## データモデル

### UserRegisteredRoom

```prisma
model UserRegisteredRoom {
  id           String          @id @default(cuid())
  userId       String          @unique @map("user_id")
  roomId       String          @map("room_id")
  roomUrl      String          @map("room_url")
  roomName     String?         @map("room_name")
  imageUrl     String?         @map("image_url") @db.Text
  inviteCodeId String?         @unique @map("invite_code_id")
  createdAt    DateTime        @default(dbgenerated("(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')")) @map("created_at")
  updatedAt    DateTime        @default(dbgenerated("(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')")) @map("updated_at")
  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  inviteCode   InvitationCode? @relation(fields: [inviteCodeId], references: [id], onDelete: SetNull)

  @@index([roomId])
  @@map("user_registered_rooms")
}
```

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/admin/rooms/page.tsx](../app/admin/rooms/page.tsx) | ページ（認証・データ取得・レンダリング） |
| [components/admin/room-list-page.tsx](../components/admin/room-list-page.tsx) | ルーム一覧 UI・ロール変更操作 |
| [app/api/admin/users/[userId]/role/route.ts](../app/api/admin/users/%5BuserId%5D/role/route.ts) | ロール付与/削除 API |
| [lib/user-registered-room.ts](../lib/user-registered-room.ts) | `listAllRegisteredRooms()` 実装 |
| [lib/authz.ts](../lib/authz.ts) | 管理者権限・ロール判定 |
| [lib/audit.ts](../lib/audit.ts) | 監査ログ記録 |
| [lib/jst.ts](../lib/jst.ts) | JST 日時変換 |
