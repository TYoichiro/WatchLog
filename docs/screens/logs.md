# ログ一覧画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/logs` |
| レンダリング | Server Component（ページ）+ Client Component（UI） |
| 認証要否 | 必要 |
| ページタイトル | 配信ログ \| WatchLog |

配信終了時に自動保存された配信ログを一覧表示する画面です。管理者は全ユーザーのログを閲覧でき、一般ユーザーは自分の登録ルームのログのみを閲覧できます。各ログの閲覧（詳細ページへ遷移）および削除が行えます。

---

## アクセス制御

サーバーサイドで認証を確認し、条件によってリダイレクトします。

| 条件 | 動作 |
|------|------|
| 未ログイン | `/` へリダイレクト |
| 管理者（`hasTopAdminRole`） | 全ユーザーのログを取得して表示（登録ルーム不要） |
| 一般ユーザー かつ 登録ルームなし | `/search` へリダイレクト |
| 一般ユーザー かつ 登録ルームあり | 自ルームのログを取得して表示 |

---

## 画面レイアウト

### ログなし（空状態）

```
┌────────────────────────────────────────────────────────┐
│ [サイドバー]  ログ一覧 0件                              │
│              ┌──────────────────────────────────────┐  │
│              │ 保存済みログはまだありません。         │  │
│              │ 配信終了時にログが保存されます。      │  │
│              └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### ログあり

```
┌────────────────────────────────────────────────────────┐
│ [サイドバー]  ログ一覧 N件                              │
│              ┌──────────────────────────────────────┐  │
│              │ 🕐 2026/05/09(土) 12:00:00           │  │
│              │   [Live ID: 1234567]                  │  │
│              │   💬コメント 42  🎁ギフト 10          │  │
│              │                    [閲覧 >]  [削除]  │  │
│              ├──────────────────────────────────────┤  │
│              │ 🕐 2026/05/08(金) 20:30:00           │  │
│              │   [Live ID: 1234568]                  │  │
│              │   💬コメント 18  🎁ギフト 5           │  │
│              │                    [閲覧 >]  [削除]  │  │
│              └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 状態管理

### ページコンポーネント（Server Component）

ページコンポーネントがサーバーサイドでログを取得し、`initialLogs` として `LogListPage` に渡します。クライアントでのローディング状態はありません。

### LogListPage（Client Component）

| state 変数 | 型 | 初期値 | 説明 |
|------------|----|----|------|
| `logs` | `LogListItem[]` | `initialLogs`（遅延初期化） | 表示中のログ一覧 |
| `pendingDeleteLog` | `LogListItem \| null` | `null` | 削除確認中のログ |
| `isDeleting` | `boolean` | `false` | 削除処理中フラグ |
| `deleteErrorMessage` | `string \| null` | `null` | 削除エラーメッセージ |

---

## コンポーネント構成

### ページ

- **ファイル**: [app/logs/page.tsx](../app/logs/page.tsx)
- **種別**: Server Component (async)
- **キャッシュ制御**: `force-dynamic`
- **AppShell**: `activeKey="logs"`

**処理フロー（管理者）**:
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `hasTopAdminRole(userId)` で管理者判定
3. 管理者なら `listAllOnliveLogs()` で全ログ取得（最大 500 件）
4. `<LogListPage initialLogs={...}>` をレンダリング

**処理フロー（一般ユーザー）**:
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `hasTopAdminRole(userId)` → false
3. `getUserRegisteredRoom(userId)` と `listUserOnliveLogs(userId)` を `Promise.all` で並行実行
   - `listUserOnliveLogs` は内部で `getUserRegisteredRoom` を再度呼ぶが、登録ルームがなければ空配列を返す
4. 登録ルームがなければ `/search` へリダイレクト
5. `<LogListPage initialLogs={...}>` をレンダリング

**データ変換** (`toListItem`):
- `capturedAt`, `createdAt`, `updatedAt`: `Date` → `toJstWallTimeIsoString()` で JST ISO 文字列に変換
- その他フィールドはそのまま渡す

### LogListPage

- **ファイル**: [components/logs/log-list-page.tsx](../components/logs/log-list-page.tsx)
- **種別**: Client Component (`"use client"`)

### 各ログ行

| 要素 | 内容 |
|------|------|
| 日時（CalendarClock アイコン） | `formatLogDate(log.capturedAt)` |
| Live ID バッジ | `Live ID: {log.liveId}`（outline バッジ） |
| コメント数（MessageSquareText アイコン） | `コメント {log.commentCount}` |
| ギフト数（Gift アイコン） | `ギフト {log.giftCount}` |
| 「閲覧」ボタン | `/logs/{log.id}` へ遷移（ChevronRight アイコン付き） |
| 「削除」ボタン | 削除確認ダイアログを開く（Trash2 アイコン付き、Destructive バリアント） |

**`formatLogDate` フォーマット**: `YYYY/MM/DD(曜日) HH:MM:SS`（JST、秒まで表示）

**行の区切り**: `border-b border-slate-100` / 最終行は `last:border-b-0`

---

### AlertDialog（削除確認）

| 要素 | 内容 |
|------|------|
| タイトル | 「ログを削除しますか？」 |
| 説明 | `{formatLogDate(capturedAt)} のログを削除します。` |
| エラー表示 | `deleteErrorMessage` があればローズ色で表示 |
| 「いいえ」ボタン | キャンセル（削除中は `disabled`） |
| 「はい」ボタン | 削除実行（削除中はスピナー表示・`disabled`） |

削除中にダイアログを閉じようとした場合（`isDeleting = true`）、`onOpenChange` で閉じ操作を無視します。

---

## 削除フロー

```
「削除」ボタンをクリック
  │
  ▼ setPendingDeleteLog(log) → AlertDialog が開く
  │
  ▼ 「はい」をクリック → handleConfirmDelete()
DELETE /api/onlive/logs/{logId}
  │
  ├─ 成功
  │   ├─ setLogs(current.filter(log => log.id !== deletedId)) でリストから除去
  │   ├─ setPendingDeleteLog(null) でダイアログを閉じる
  │   └─ router.refresh() でサーバーサイドを再取得
  │
  └─ 失敗
      ├─ deleteErrorMessage にエラーメッセージをセット
      └─ ダイアログは開いたまま（エラーメッセージを表示）
```

---

## API エンドポイント

### DELETE /api/onlive/logs/{logId}

- **ファイル**: [app/api/onlive/logs/[logId]/route.ts](../app/api/onlive/logs/%5BlogId%5D/route.ts)
- **認証**: 必要（`requireUser()`）
- **キャッシュ制御**: `force-dynamic`

**内部処理** (`deleteUserOnliveLog`):
- 登録ルーム確認 → なければ `false` 返却
- `prisma.onliveLog.updateMany({ where: { id, isDeleted: false, roomId: registeredRoom.roomId }, data: { isDeleted: true } })`
- **論理削除**（物理削除ではなく `isDeleted = true` に更新）
- 自ルームのログのみ削除可能（`roomId` で権限チェック）

**レスポンス**:

```json
{ "ok": true }
```

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 400 | `logId` が空文字 |
| 401 | 未認証 |
| 404 | 対象ログが存在しない、または他ルームのログ |
| 500 | DB エラー |

> ログ保存 API（`POST /api/onlive/logs`）は配信画面から呼び出されるものであり、ログ一覧画面からは使用しません。詳細は配信画面の設計書を参照してください。

---

## データ取得

### listUserOnliveLogs（一般ユーザー）

- **ファイル**: [lib/onlive-log.ts](../lib/onlive-log.ts)
- `getUserRegisteredRoom(userId)` で登録ルームを取得（なければ空配列を返す）
- 条件: `isDeleted = false` かつ `roomId = registeredRoom.roomId`
- ソート: `capturedAt DESC`
- **最大取得件数: 100 件**

### listAllOnliveLogs（管理者）

- **ファイル**: [lib/onlive-log.ts](../lib/onlive-log.ts)
- 全ルームのログを `isDeleted = false` で取得
- ソート: `capturedAt DESC`
- **最大取得件数: 500 件**
- `prisma.userRegisteredRoom.findMany()` と `Promise.all` で並行実行し、ルーム名をマッピング

### ログサマリー集計（`getLogSummaryCounts`）

DB の `log` JSON カラムから各カウントを取得します。

| フィールド | 取得元（JSON パス） |
|-----------|------------------|
| `commentCount` | `log.comments.length` |
| `giftCount` | `log.gifts.length` |
| `liveRankingCount` | `log.rankings.live.length` |
| `totalRankingCount` | `log.rankings.total.length` |

---

## データモデル

### OnliveLog（Prismaスキーマ）

```prisma
model OnliveLog {
  id         String   @id @default(cuid())
  roomId     String
  liveId     String
  capturedAt DateTime
  log        Json
  isDeleted  Boolean  @default(false)
  createdAt  DateTime @default(dbgenerated(...))
  updatedAt  DateTime @updatedAt

  @@unique([roomId, liveId, capturedAt])
  @@index([roomId, liveId])
  @@index([roomId, isDeleted, capturedAt])
  @@map("onlive_logs")
}
```

**ユニーク制約**: `(roomId, liveId, capturedAt)` — 同じ配信・同じキャプチャ時刻のログは 1 件のみ

**インデックス**:
- `(roomId, liveId)` — 配信単位での検索
- `(roomId, isDeleted, capturedAt)` — 一覧取得クエリの最適化

**論理削除**: `isDeleted = true` で論理削除（物理削除は行わない）

---

## 型定義

### LogListItem

```typescript
// components/logs/log-list-page.tsx
type LogListItem = {
  capturedAt: string;       // JST ISO文字列
  commentCount: number;
  createdAt: string;        // JST ISO文字列
  giftCount: number;
  id: string;
  liveId: string;
  liveRankingCount: number;
  roomId: string;
  roomName: string | null;
  totalRankingCount: number;
  updatedAt: string;        // JST ISO文字列
};
```

### OnliveLogListItem（サーバー側）

```typescript
// lib/onlive-log.ts
type OnliveLogListItem = {
  capturedAt: Date;
  commentCount: number;
  createdAt: Date;
  giftCount: number;
  id: string;
  liveId: string;
  liveRankingCount: number;
  roomId: string;
  roomName: string | null;
  totalRankingCount: number;
  updatedAt: Date;
};
```

---

## ページネーション・フィルタリング

| 機能 | 実装状況 |
|------|---------|
| ページネーション | なし（固定件数取得） |
| 無限スクロール | なし |
| フィルタリング | なし（取得時に論理削除・ルームID で絞り込み） |
| ソート変更 | なし（常に `capturedAt DESC`） |
| 検索 | なし |

---

## エラーハンドリング

| エラー種別 | 処理 |
|----------|------|
| ログ削除失敗 | `deleteErrorMessage` にメッセージをセット → 確認ダイアログ内にローズ色で表示 |
| 削除エラーレスポンスに `error` フィールドなし | フォールバック「ログの削除に失敗しました」を使用 |

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/logs/page.tsx](../app/logs/page.tsx) | ページコンポーネント（認証・データ取得） |
| [app/logs/[logId]/page.tsx](../app/logs/%5BlogId%5D/page.tsx) | ログ詳細ページ（別画面） |
| [components/logs/log-list-page.tsx](../components/logs/log-list-page.tsx) | ログ一覧 UI・削除操作 |
| [app/api/onlive/logs/[logId]/route.ts](../app/api/onlive/logs/%5BlogId%5D/route.ts) | ログ削除 API |
| [lib/onlive-log.ts](../lib/onlive-log.ts) | ログ DB 操作・集計 |
| [lib/authz.ts](../lib/authz.ts) | 管理者判定・認証 |
| [lib/user-registered-room.ts](../lib/user-registered-room.ts) | 登録ルーム取得 |
| [lib/jst.ts](../lib/jst.ts) | JST 日時変換ユーティリティ |
