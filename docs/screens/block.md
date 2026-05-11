# ブロック画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/block` |
| レンダリング | Server Component（ページ）+ Client Component（UI） |
| 認証要否 | 必要 |
| ページタイトル | ブロックリスト \| WatchLog |

ブロック中のSHOWROOMユーザーを一覧表示し、追加・解除ができる画面です。ユーザー名をクリックすると詳細プロフィールモーダルが開き、そこからブロック操作も行えます。

---

## アクセス制御

サーバーサイドで認証を確認し、条件によってリダイレクトします。

| 条件 | 動作 |
|------|------|
| 未ログイン | `/` へリダイレクト |
| ログイン済み かつ 登録ルームなし | `/search` へリダイレクト |
| ログイン済み かつ 登録ルームあり | ブロック画面を表示 |

---

## 画面レイアウト

### 読み込み中（スケルトン）

```
┌────────────────────────────────────────────────────────┐
│ [サイドバー]  ブロックユーザー N件                       │
│              ┌──────────────────────────────────────┐  │
│              │ ID    ユーザー名  ブロック日時  削除  │  │
│              │ ████  ████████   ████████████  ████  │  │
│              │ ████  ████████   ████████████  ████  │  │
│              │ ████  ████████   ████████████  ████  │  │
│              │ ████  ████████   ████████████  ████  │  │
│              │ ████  ████████   ████████████  ████  │  │
│              └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 読み込み完了

```
┌────────────────────────────────────────────────────────┐
│ [サイドバー]  ブロックユーザー N件                       │
│              ┌──────────────────────────────────────┐  │
│              │ ID     ユーザー名  ブロック日時  削除 │  │
│              ├──────────────────────────────────────┤  │
│              │ 9001  [田中 太郎]  2026/05/01...  [削除]│ │
│              │ 9002  [山田 花子]  2026/04/15...  [削除]│ │
│              └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 状態管理

### ページコンポーネント（Server Component）

- **ファイル**: [app/block/page.tsx](../app/block/page.tsx)
- `auth()` → `getUserRegisteredRoom()` → `<BlockListPage roomId={registeredRoom.roomId} />`

### BlockListPage（Client Component）

- **ファイル**: [components/block/block-list-page.tsx](../components/block/block-list-page.tsx)

**useUserBlocks フックの戻り値**:

| 変数 | 型 | 説明 |
|------|----|------|
| `blocks` | `UserBlockListItem[]` | ブロック一覧 |
| `blockedUserIds` | `Set<string>` | ブロック済みユーザーID のセット（`useMemo`） |
| `isLoading` | `boolean` | 初期取得中フラグ |
| `hasError` | `boolean` | 初期取得エラーフラグ |
| `blockUser` | `Function` | ブロック追加関数 |
| `deleteBlock` | `Function` | ブロック削除関数 |

**コンポーネント内ローカル State**:

| state 変数 | 型 | 初期値 | 説明 |
|------------|----|----|------|
| `selectedProfileTarget` | `ProfileTarget \| null` | `null` | プロフィールモーダルで表示中のユーザー |
| `profileCache` | `Record<string, RoomUserProfile>` | `{}` | 取得済みプロフィールのキャッシュ |
| `isProfileLoading` | `boolean` | `false` | プロフィール取得中フラグ |
| `hasProfileError` | `boolean` | `false` | プロフィール取得エラーフラグ |
| `profileView` | `ProfileView` | `"user"` | プロフィールモーダルの表示タブ |
| `pendingDeleteBlock` | `UserBlockListItem \| null` | `null` | 削除確認中のブロック |
| `isDeleting` | `boolean` | `false` | 削除処理中フラグ |
| `deleteErrorMessage` | `string \| null` | `null` | 削除エラーメッセージ |
| `isBlockActionPending` | `boolean` | `false` | ブロック操作中フラグ |
| `blockErrorMessage` | `string \| null` | `null` | ブロック操作エラーメッセージ |

---

## コンポーネント構成

### ページ

- **ファイル**: [app/block/page.tsx](../app/block/page.tsx)
- **種別**: Server Component (async)
- **キャッシュ制御**: `force-dynamic`
- **AppShell**: `activeKey="block"`

**処理フロー**:
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `getUserRegisteredRoom(userId)` で登録ルームを確認、なければ `/search` へリダイレクト
3. `<AppShell activeKey="block">` 内に `<BlockListPage roomId={registeredRoom.roomId}>` をレンダリング

### BlockListPage

- **ファイル**: [components/block/block-list-page.tsx](../components/block/block-list-page.tsx)
- **種別**: Client Component (`"use client"`)

### BlockTableSkeleton

テーブルボディの 5 行分スケルトン（`animate-pulse`）。`isLoading = true` のとき表示。

### UserProfileModal

- **インポート元**: `@/components/onlive/onlive-room-page`
- プロフィール詳細の表示とブロック追加操作を行うモーダル。

**渡す Props**:

| prop | 説明 |
|------|------|
| `target` | 表示対象ユーザー（`ProfileTarget \| null`） |
| `profile` | 取得済みプロフィール（`RoomUserProfile \| null`） |
| `blockedUserIds` | ブロック済みユーザーID セット |
| `isLoading` | プロフィール取得中フラグ |
| `hasError` | プロフィール取得エラーフラグ |
| `isBlockActionPending` | ブロック操作中フラグ |
| `blockErrorMessage` | ブロック操作エラーメッセージ |
| `view` | 表示タブ（`ProfileView`） |
| `onOpenChange` | モーダル開閉ハンドラ |
| `onBlockUser` | ブロック実行ハンドラ |
| `onViewChange` | タブ切り替えハンドラ |

### AlertDialog（削除確認）

削除ボタンクリックで表示される確認ダイアログ。

| 要素 | 内容 |
|------|------|
| タイトル | 「削除しますか？」 |
| 説明 | `{blockedUserName} のブロックを解除します。` |
| エラー表示 | `deleteErrorMessage` があればローズ色で表示 |
| 「いいえ」ボタン | キャンセル（削除中は `disabled`） |
| 「はい」ボタン | 削除実行（削除中はスピナー表示・`disabled`） |

---

## テーブル表示

**テーブル列**:

| 列名 | 内容 | 備考 |
|------|------|------|
| ID | `block.blockedUserId`（SHOWROOM ユーザーID） | `text-sm font-medium` |
| ユーザー名 | `block.blockedUserName`（クリックでプロフィールモーダル） | アンダーライン hover |
| ブロック日時 | `formatBlockedAt(block.createdAt)` の JST フォーマット | 秒単位まで表示 |
| 削除 | Trash2 アイコン付きの Destructive ボタン | 右寄せ |

**`formatBlockedAt` フォーマット**: `YYYY/MM/DD HH:MM:SS`（JST、秒まで表示）

**テーブルのスクロール**: `min-w-[720px]` のため、狭い画面では横スクロール可能

**行ホバー**: `hover:bg-slate-50`

---

## ブロック一覧の表示状態

| 条件 | 表示 |
|------|------|
| `isLoading = true` | `BlockTableSkeleton`（5 行スケルトン） |
| `hasError = true` | ローズ色エラーメッセージ「ブロック一覧を取得できませんでした。」 |
| `blocks.length === 0` | 「ブロック中のユーザーはいません。」 |
| `blocks.length > 0` | ブロック一覧テーブル |

---

## プロフィール表示フロー

```
ユーザー名をクリック
  │
  ▼ openProfile(block)
  selectedProfileTarget = { userId, userName } をセット
  エラー・ビュー状態をリセット
  │
  ▼ useEffect 発火（selectedProfileTarget が変わり、cache になければ）
GET /api/room/user-profile?room_id={roomId}&user_id={userId}
  │
  ├─ 成功 → profileCache に保存 → UserProfileModal にプロフィール渡す
  └─ 失敗 → hasProfileError = true → UserProfileModal でエラー表示

ユーザーがモーダルを閉じる
  │
  ▼ handleProfileOpenChange(false)
  selectedProfileTarget, profileView, エラー状態をすべてクリア
```

プロフィールは `profileCache` にキャッシュされるため、同一ユーザーの再表示時は API を呼び出しません。

---

## Custom Hook（useUserBlocks）

- **ファイル**: [hooks/use-user-blocks.ts](../hooks/use-user-blocks.ts)
- **種別**: `"use client"`

**初期化**:
- コンポーネントマウント時に `AbortController` を作成し `GET /api/blocks` を呼び出す
- `AbortError` は無視、その他のエラーは `hasError = true`
- 完了後（成功・失敗問わず）`isLoading = false`

**`blockUser(blockedUserId, blockedUserName)`**:
- `POST /api/blocks`
- 返却された block を `replaceOrPrependBlock()` でリストに反映
  - 同一 `blockedUserId` が既存 → その位置で置換
  - 新規 → 先頭に追加

**`deleteBlock(blockId)`**:
- `DELETE /api/blocks/{blockId}`
- 成功時 `filter` で対象を除去

---

## API エンドポイント

### GET /api/blocks

- **ファイル**: [app/api/blocks/route.ts](../app/api/blocks/route.ts)
- **認証**: 必要（`requireUser()`）
- **キャッシュ制御**: `force-dynamic`

**レスポンス**:

```json
{
  "blocks": [
    {
      "id": "cuid",
      "blockedUserId": "9001",
      "blockedUserName": "田中 太郎",
      "createdAt": "2026-05-01T12:00:00.000+09:00",
      "updatedAt": "2026-05-01T12:00:00.000+09:00"
    }
  ]
}
```

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 401 | 未認証 |
| 500 | DB エラー |

---

### POST /api/blocks

- **ファイル**: [app/api/blocks/route.ts](../app/api/blocks/route.ts)
- **認証**: 必要（`requireUser()`）

**リクエストボディ**:

```json
{
  "blockedUserId": "9001",
  "blockedUserName": "田中 太郎"
}
```

**内部処理** (`createUserBlock`):
- `blockedUserId === DEVELOPER_USER_ID` のとき `DeveloperBlockForbiddenError` をスロー
- `upsert` — 同一 `(blockerUserId, blockedShowroomUserId)` が既存なら `blockedShowroomUserName` を更新

**レスポンス**:

```json
{
  "block": {
    "id": "cuid",
    "blockedUserId": "9001",
    "blockedUserName": "田中 太郎",
    "createdAt": "2026-05-01T12:00:00.000+09:00",
    "updatedAt": "2026-05-01T12:00:00.000+09:00"
  }
}
```

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 400 | リクエストボディが無効な JSON |
| 400 | `blockedUserId` または `blockedUserName` が未指定・空文字 |
| 401 | 未認証 |
| 403 | 開発者ユーザーをブロックしようとした |
| 500 | DB エラー |

---

### DELETE /api/blocks/{blockId}

- **ファイル**: [app/api/blocks/[blockId]/route.ts](../app/api/blocks/%5BblockId%5D/route.ts)
- **認証**: 必要（`requireUser()`）

**内部処理** (`deleteUserBlock`):
- `prisma.userBlock.deleteMany({ where: { id: blockId, blockerUserId: userId } })`
- `blockerUserId = userId` の条件が本人確認を兼ねる

**レスポンス**:

```json
{ "ok": true }
```

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 400 | `blockId` が空文字 |
| 401 | 未認証 |
| 404 | 対象ブロックが存在しない、または他人のブロック |
| 500 | DB エラー |

---

## データモデル

### UserBlock（Prismaスキーマ）

```prisma
model UserBlock {
  id                      String   @id @default(cuid())
  blockerUserId           String
  blockedShowroomUserId   String
  blockedShowroomUserName String
  createdAt               DateTime @default(dbgenerated(...))
  updatedAt               DateTime @updatedAt
  blocker                 User     @relation("UserBlocks", fields: [blockerUserId], ...)

  @@unique([blockerUserId, blockedShowroomUserId])
  @@index([blockedShowroomUserId])
  @@index([blockerUserId, createdAt])
  @@map("user_blocks")
}
```

**ユニーク制約**: `(blockerUserId, blockedShowroomUserId)` — 同一ユーザーは 1 件のみ

**インデックス**:
- `blockedShowroomUserId` — 他画面でのブロックフィルタリングに使用
- `(blockerUserId, createdAt)` — ブロック一覧の降順ソート最適化

---

## 型定義

### UserBlockListItem

```typescript
// hooks/use-user-blocks.ts
type UserBlockListItem = {
  id: string;
  blockedUserId: string;
  blockedUserName: string;
  createdAt: string;   // JST ISO文字列
  updatedAt: string;   // JST ISO文字列
};
```

### ProfileTarget

```typescript
// components/onlive/onlive-room-page.tsx から import
type ProfileTarget = {
  userId: string;
  userName: string;
};
```

---

## エラーハンドリング

| エラー種別 | 処理 |
|----------|------|
| ブロック一覧取得失敗 | `hasError = true` → テーブルにローズ色エラーメッセージ |
| プロフィール取得失敗 | `hasProfileError = true` → モーダル内にエラー表示 |
| プロフィール取得 `AbortError` | 無視（コンポーネントアンマウント時のキャンセル） |
| ブロック追加失敗 | `blockErrorMessage` → モーダル内にエラー表示 |
| ブロック削除失敗 | `deleteErrorMessage` → 削除確認ダイアログ内にエラー表示 |
| 削除中にダイアログを閉じようとする | `isDeleting = true` のとき `onOpenChange` を無視 |

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/block/page.tsx](../app/block/page.tsx) | ページコンポーネント（認証・リダイレクト） |
| [components/block/block-list-page.tsx](../components/block/block-list-page.tsx) | ブロック一覧 UI・状態管理 |
| [hooks/use-user-blocks.ts](../hooks/use-user-blocks.ts) | ブロック状態管理カスタムフック |
| [app/api/blocks/route.ts](../app/api/blocks/route.ts) | GET・POST API |
| [app/api/blocks/[blockId]/route.ts](../app/api/blocks/%5BblockId%5D/route.ts) | DELETE API |
| [lib/user-blocks.ts](../lib/user-blocks.ts) | ブロック DB 操作・ビジネスロジック |
| [lib/showroom-block-filter.ts](../lib/showroom-block-filter.ts) | ブロックフィルター関数（他画面でも使用） |
| [components/onlive/onlive-room-page.tsx](../components/onlive/onlive-room-page.tsx) | UserProfileModal・ProfileTarget 型定義 |
