# ログ一覧画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/logs` |
| レンダリング | Server Component（ページ）+ Client Component（UI） |
| 認証要否 | 必要 |
| ページタイトル | 配信ログ \| WatchLog |

配信終了時に自動保存された配信ログを一覧表示する画面です。管理者は全ユーザーのログを閲覧でき、プレミアムユーザーは自分の登録ルームの DB ログを閲覧できます。非プレミアムユーザーはローカルストレージに保存された直近 1 件のログのみを閲覧できます。各ログに対して「閲覧」（詳細ページへ遷移）・「ダウンロード」（JSON ファイル出力）・「削除」が行えます。また、ダウンロードした JSON ファイルをインポートしてログを閲覧する機能（全ユーザー共通）も備えています。

---

## アクセス制御

サーバーサイドで認証を確認し、条件によってリダイレクトします。

| 条件 | 動作 |
|------|------|
| 未ログイン | `/` へリダイレクト |
| 管理者（`hasTopAdminRole`） | 全ユーザーのログを取得して表示（登録ルーム・プレミアム判定不要） |
| 一般ユーザー かつ 登録ルームなし | `/search` へリダイレクト |
| 一般ユーザー かつ 登録ルームあり かつ プレミアム | 自ルームの DB ログを取得して表示 |
| 一般ユーザー かつ 登録ルームあり かつ 非プレミアム | `initialLogs=[]` で `LogListPage` を表示（ローカルストレージからの表示は `LogListPage` 側で処理） |

---

## 画面レイアウト

### ログなし（空状態）

```
┌────────────────────────────────────────────────────────┐
│ [サイドバー]  ログ一覧 0件                              │
│              ┌──────────────────────────────────────┐  │
│              │ 📄 JSONログ閲覧                        │  │
│              │   ダウンロードしたJSONファイルを      │  │
│              │   選択してログを閲覧できます           │  │
│              │                    [JSONを選択]        │  │
│              └──────────────────────────────────────┘  │
│              ┌──────────────────────────────────────┐  │
│              │ 保存済みログはまだありません。         │  │
│              │ 配信終了時にログが保存されます。      │  │
│              └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### ログあり

```
┌────────────────────────────────────────────────────────────────┐
│ [サイドバー]  ログ一覧 N件                                      │
│              ┌──────────────────────────────────────────────┐  │
│              │ 📄 JSONログ閲覧                                │  │
│              │   ダウンロードしたJSONファイルを選択して       │  │
│              │   ログを閲覧できます                           │  │
│              │                           [JSONを選択]        │  │
│              └──────────────────────────────────────────────┘  │
│              ┌──────────────────────────────────────────────┐  │
│              │ 🕐 2026/05/09(土) 12:00:00                   │  │
│              │   [Live ID: 1234567]                          │  │
│              │   💬コメント 42  🎁ギフト 10                  │  │
│              │     [閲覧 >]  [↓ダウンロード]  [🗑️削除]     │  │
│              ├──────────────────────────────────────────────┤  │
│              │ 🕐 2026/05/08(金) 20:30:00                   │  │
│              │   [Live ID: 1234568]                          │  │
│              │   💬コメント 18  🎁ギフト 5                   │  │
│              │     [閲覧 >]  [↓ダウンロード]  [🗑️削除]     │  │
│              └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 状態管理

### ページコンポーネント（Server Component）

ページコンポーネントがサーバーサイドでログを取得し、`initialLogs` として `LogListPage` に渡します。クライアントでのローディング状態はありません。

### LogListPage（Client Component）

**Props：**

| prop | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `initialLogs` | `LogListItem[]` | — | サーバーから渡された初期ログ一覧（プレミアムユーザー・管理者のみ有効） |
| `isPremium` | `boolean` | `true` | プレミアムユーザーか否か（非プレミアム時はローカルストレージを使用） |
| `roomId` | `string \| undefined` | — | 非プレミアムユーザーのローカルストレージキー用ルームID |

**state 変数：**

| state 変数 | 型 | 初期値 | 説明 |
|------------|----|----|------|
| `logs` | `LogListItem[]` | `initialLogs`（非プレミアム時はローカルストレージから読み込み） | 表示中のログ一覧 |
| `pendingDeleteLog` | `LogListItem \| null` | `null` | 削除確認中のログ |
| `isDeleting` | `boolean` | `false` | 削除処理中フラグ |
| `deleteErrorMessage` | `string \| null` | `null` | 削除エラーメッセージ |
| `downloadingLogId` | `string \| null` | `null` | ダウンロード処理中のログ ID |
| `jsonImportError` | `string \| null` | `null` | JSONインポートエラーメッセージ |
| `fileInputRef` | `RefObject<HTMLInputElement \| null>` | — | JSONファイル選択用 `<input type="file">` の ref |

**初期化ロジック（`useState` 遅延初期化）：**
- `isPremium = false` かつ `roomId` が指定されている場合：`readOnliveLocalLog(roomId)` を呼び出し、ローカルストレージに保存されたログを1件読み込む。存在する場合は `localLogToListItem()` でマッピングして `[localLogToListItem(localLog)]` を初期値とする。データがなければ空配列
- それ以外：`initialLogs` をそのまま使用

**ローカルログのマッピング（`localLogToListItem`）：**

`OnliveLocalLog` → `LogListItem` への変換関数。`id` フィールドには `local:{roomId}` 形式のプレフィックス付き文字列を設定する（DB ログとローカルログを区別するため）。

| `LogListItem` フィールド | マッピング元 |
|---|---|
| `id` | `"local:" + log.roomId` |
| `capturedAt` | `log.capturedAt` |
| `commentCount` | `log.commentCount` |
| `createdAt` | `log.savedAt` |
| `giftCount` | `log.giftCount` |
| `liveId` | `log.liveId` |
| `liveRankingCount` | `log.liveRankingCount` |
| `roomId` | `log.roomId` |
| `roomName` | `log.roomName` |
| `totalRankingCount` | `0`（ローカルログは累計ランキング未保持） |
| `updatedAt` | `log.savedAt` |

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
3. `getUserRegisteredRoom(userId)` と `hasPremiumRole(userId)` を `Promise.all` で並行実行
4. 登録ルームがなければ `/search` へリダイレクト
5. プレミアムユーザー（`isPremium = true`）の場合：`listUserOnliveLogs(userId)` で DB ログ取得
   - `<LogListPage initialLogs={...}>` をレンダリング
6. 非プレミアムユーザー（`isPremium = false`）の場合：ログ取得なし
   - `<LogListPage initialLogs={[]} isPremium={false} roomId={registeredRoom.roomId}>` をレンダリング
   - ローカルストレージからのログ読み込みは `LogListPage` 側の `useState` 遅延初期化で実施

**データ変換** (`toListItem`):
- `capturedAt`, `createdAt`, `updatedAt`: `Date` → `toJstWallTimeIsoString()` で JST ISO 文字列に変換
- その他フィールドはそのまま渡す

### LogListPage

- **ファイル**: [components/logs/log-list-page.tsx](../components/logs/log-list-page.tsx)
- **種別**: Client Component (`"use client"`)

#### JSONログ閲覧カード

ログ一覧の最上部（`h1` の直下）に常時表示されるカード。

| 要素 | 内容 |
|------|------|
| アイコン | `FileJson`（slate） |
| タイトル | 「JSONログ閲覧」 |
| 説明 | 「ダウンロードしたJSONファイルを選択してログを閲覧できます」「（旧バージョン（v2.X.X系）の互換性はありません）」 |
| ボタン | 「JSONを選択」（outline, sm） → 非表示の `<input type="file" accept=".json">` をトリガー |
| エラー表示 | `jsonImportError` があれば rose 色で表示 |

**JSONファイル選択フロー（`handleJsonFileChange`）：**

```
ファイル選択
  │
  ▼ FileReader で JSON を読み込み
  │
  ├─ isValidJsonViewerLog(parsed) = false
  │   └─ jsonImportError = "正しい形式のWatchLog JSONファイルではありません。"
  │
  ├─ 正常
  │   ├─ writeJsonViewerLog(parsed) でローカルストレージに保存（キー: watchlog:json-viewer）
  │   └─ router.push("/logs/json-import") → JSONインポートビューアへ遷移
  │
  ├─ JSON.parse 例外
  │   └─ jsonImportError = "JSONファイルの読み込みに失敗しました。"
  │
  └─ FileReader onerror
      └─ jsonImportError = "ファイルの読み込みに失敗しました。"
```

### 各ログ行

| 要素 | 内容 |
|------|------|
| 日時（CalendarClock アイコン） | `formatLogDate(log.capturedAt)` |
| Live ID バッジ | `Live ID: {log.liveId}`（outline バッジ） |
| コメント数（MessageSquareText アイコン） | `コメント {log.commentCount}` |
| ギフト数（Gift アイコン） | `ギフト {log.giftCount}` |
| 「閲覧」ボタン | `log.id.startsWith("local:")` の場合 `/logs/local/{log.roomId}` へ遷移、それ以外は `/logs/{encodeURIComponent(log.id)}` へ遷移（ChevronRight アイコン付き） |
| 「ダウンロード」ボタン | ログを JSON ファイルとしてダウンロード（Download アイコン付き、ダウンロード中はスピナー表示・`disabled`） |
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

### ログ詳細ページ（DB ログ）

- **ファイル**: [app/logs/[logId]/page.tsx](../app/logs/%5BlogId%5D/page.tsx)
- **種別**: Server Component (async)
- **URL**: `/logs/{logId}`
- **ページタイトル**: `配信ログ詳細 | WatchLog`
- **キャッシュ制御**: `force-dynamic`

**処理フロー：**
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `hasTopAdminRole(userId)` で管理者判定
3. 管理者なら `getAnyOnliveLog(logId)`、一般ユーザーなら `getUserOnliveLog(userId, logId)` でログ取得
4. ログが存在しない場合は `notFound()`
5. `toViewerData()` で `OnliveLogViewerData` に変換して `OnliveLogViewerPage` をレンダリング

**`toViewerData` 変換：**

| `OnliveLogViewerData` フィールド | マッピング元 |
|---|---|
| `capturedAt` | `toJstWallTimeIsoString(log.capturedAt)` |
| `createdAt` | `toJstWallTimeIsoString(log.createdAt)` |
| `id` | `log.id` |
| `liveId` | `log.liveId` |
| `liveStartedAt` | `log.liveStartedAt` |
| `log` | `log.log` |
| `room` | `log.room` |
| `roomId` | `log.roomId` |
| `updatedAt` | `toJstWallTimeIsoString(log.updatedAt)` |

### ローカルログ詳細ページ

- **ファイル**: [app/logs/local/[roomId]/page.tsx](../app/logs/local/%5BroomId%5D/page.tsx)
- **種別**: Server Component (async) + `LocalLogViewerPage`（Client Component）
- **URL**: `/logs/local/{roomId}`
- **ページタイトル**: `配信ログ詳細 | WatchLog`
- **キャッシュ制御**: `force-dynamic`
- **用途**: 非プレミアムユーザーがローカルストレージに保存した配信ログを閲覧する

**処理フロー：**
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `params.roomId` を取得して `LocalLogViewerPage` をレンダリング

**`LocalLogViewerPage`（Client Component）：**
- `useSyncExternalStore` でローカルストレージの `watchlog:saved-log:{roomId}` を購読
- ログが存在しない場合：「ローカルのログが見つかりませんでした。」を表示
- ログが存在する場合：`toViewerData()` で変換して `OnliveLogViewerPage` をレンダリング

**`toViewerData` 変換（ローカルログ）：**

| `OnliveLogViewerData` フィールド | マッピング元 |
|---|---|
| `capturedAt` | `localLog.capturedAt` |
| `createdAt` | `localLog.savedAt` |
| `id` | `"local:" + localLog.liveId` |
| `liveId` | `localLog.liveId` |
| `liveStartedAt` | `null` |
| `log` | `localLog.log` |
| `room` | `null` |
| `roomId` | `localLog.roomId` |
| `updatedAt` | `localLog.savedAt` |

### JSONインポートビューアページ

- **ファイル**: [app/logs/json-import/page.tsx](../app/logs/json-import/page.tsx)
- **種別**: Server Component (async) + `JsonImportViewerPage`（Client Component）
- **URL**: `/logs/json-import`
- **ページタイトル**: `JSONログ閲覧 | WatchLog`
- **キャッシュ制御**: `force-dynamic`
- **用途**: `LogListPage` でインポートした JSON ファイルのログを閲覧する（全ユーザー共通）

**処理フロー：**
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `JsonImportViewerPage` をレンダリング

**`JsonImportViewerPage`（Client Component）：**
- `useState` 遅延初期化で `readJsonViewerLog()` を呼び出しローカルストレージの `watchlog:json-viewer` を取得
- ログが存在しない場合：「JSONログが見つかりませんでした。ログ一覧からJSONファイルを選択してください。」を表示
- ログが存在する場合：`toViewerData()` で変換して `OnliveLogViewerPage` をレンダリング

**`toViewerData` 変換（JSON インポート）：**

| `OnliveLogViewerData` フィールド | マッピング元 |
|---|---|
| `capturedAt` | `stored.capturedAt` |
| `createdAt` | `stored.capturedAt` |
| `id` | `"json-import:" + stored.liveId` |
| `liveId` | `stored.liveId` |
| `liveStartedAt` | `null` |
| `log` | `stored.log` |
| `room` | `null` |
| `roomId` | `stored.roomId` |
| `updatedAt` | `stored.capturedAt` |

---

## ダウンロードフロー

ダウンロード機能は**全ユーザー共通**で利用可能です（管理者・プレミアム・非プレミアム問わず）。

### プレミアムユーザー・管理者（DB ログ）

```
「ダウンロード」ボタンをクリック
  │
  ▼ setDownloadingLogId(log.id) → ボタンにスピナー表示・disabled
  │
  ▼ handleDownload()
GET /api/onlive/logs/{logId}
  │
  ├─ 成功（200）
  │   ├─ Blob を生成（JSON、インデント2）
  │   ├─ URL.createObjectURL(blob) で一時 URL を取得
  │   ├─ <a> 要素を動的生成し、href と download 属性をセット
  │   ├─ a.click() でブラウザのファイルダウンロードをトリガー
  │   └─ URL.revokeObjectURL(url) で一時 URL を解放
  │
  ├─ 失敗（response.ok = false）
  │   └─ ダウンロードをスキップ（エラー表示なし）
  │
  └─ 例外発生時（ネットワークエラー等）
      └─ エラーを無視（ダウンロードをスキップ）
  │
  ▼ setDownloadingLogId(null) → ボタンを通常状態に戻す
```

### 非プレミアムユーザー（ローカルストレージ）

```
「ダウンロード」ボタンをクリック
  │
  ▼ setDownloadingLogId(log.id) → ボタンにスピナー表示・disabled
  │
  ▼ handleDownload()
  │   isPremium = false かつ roomId あり → API 呼び出しなし
  │
  ├─ readOnliveLocalLog(roomId) でローカルストレージからデータ取得
  │
  ├─ データあり
  │   ├─ Blob を生成（JSON、インデント2）
  │   ├─ URL.createObjectURL(blob) で一時 URL を取得
  │   ├─ <a> 要素を動的生成し、href と download 属性をセット
  │   ├─ a.click() でブラウザのファイルダウンロードをトリガー
  │   └─ URL.revokeObjectURL(url) で一時 URL を解放
  │
  └─ データなし
      └─ ダウンロードをスキップ（エラー表示なし）
  │
  ▼ setDownloadingLogId(null) → ボタンを通常状態に戻す
```

### ファイル名の生成（`getDownloadFilename`）

| 要素 | 説明 |
|------|------|
| プレフィックス | `watchlog` |
| ライブ ID | `log.liveId` |
| 日付 | `capturedAt` から `YYYYMMDD` を抽出（UTC 基準） |
| 拡張子 | `.json` |

**例**: `watchlog-live-123-20260509.json`

`capturedAt` が無効な日付の場合は日付部分を `unknown` にフォールバックします。

### ダウンロード JSON 構造（`LogDownloadPayload`）

```typescript
type LogDownloadPayload = {
  capturedAt: string;           // ISO 8601 文字列
  liveId: string;
  log: Record<string, unknown>; // 完全なログペイロード（comments/gifts/rankings/liveInfo 等）
  roomId: string;
};
```

**ダウンロードファイルの例**:

```json
{
  "capturedAt": "2026-05-09T03:00:00.000Z",
  "liveId": "live-123",
  "log": {
    "comments": [...],
    "gifts": [...],
    "rankings": { "live": [...], "total": [...] },
    "liveInfo": { ... },
    "roomProfile": { ... },
    "metrics": { ... }
  },
  "roomId": "12345"
}
```

インデント 2 スペースの JSON フォーマットで出力されます。

---

## 削除フロー

### プレミアムユーザー（DB ログ）

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

### 非プレミアムユーザー（ローカルストレージ）

```
「削除」ボタンをクリック
  │
  ▼ setPendingDeleteLog(log) → AlertDialog が開く
  │
  ▼ 「はい」をクリック → handleConfirmDelete()
  │   isPremium = false のため API 呼び出しなし
  │
  ├─ deleteOnliveLocalLog(roomId) でローカルストレージから削除
  ├─ setLogs([]) でリストを空に
  └─ setPendingDeleteLog(null) でダイアログを閉じる
  ※ router.refresh() は呼ばない（サーバー側に変更なし）
```

---

## API エンドポイント

### POST /api/onlive/logs

- **ファイル**: [app/api/onlive/logs/route.ts](../app/api/onlive/logs/route.ts)
- **認証**: 必要
- **プレミアム制限**: `hasPremiumRole(userId)` が `false` の場合は `403 Forbidden` を返す

> 非プレミアムユーザーはこのエンドポイントを呼び出しません。ログはローカルストレージに直接保存されます（配信画面の設計書参照）。

### GET /api/onlive/logs/{logId}

- **ファイル**: [app/api/onlive/logs/[logId]/route.ts](../app/api/onlive/logs/%5BlogId%5D/route.ts)
- **認証**: 必要（`requireUser()`）
- **キャッシュ制御**: `force-dynamic`
- **用途**: ダウンロード機能でログの完全なペイロードを取得する

**権限制御**:
- 管理者（`hasTopAdminRole`）: `getAnyOnliveLog(logId)` で任意のログを取得可能
- 一般ユーザー: `getUserOnliveLog(userId, logId)` で自ルームのログのみ取得可能

**レスポンス（200）**:

```json
{
  "capturedAt": "2026-05-09T03:00:00.000Z",
  "liveId": "live-123",
  "log": { ... },
  "roomId": "12345"
}
```

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 400 | `logId` が空文字 |
| 401 | 未認証 |
| 404 | 対象ログが存在しない、または他ルームのログ（一般ユーザー） |
| 500 | DB エラー |

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

### listUserOnliveLogs（プレミアム一般ユーザー）

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

### ローカルストレージ（非プレミアム一般ユーザー）

- **ファイル**: [lib/onlive-local-log.ts](../lib/onlive-local-log.ts)
- サーバーサイドでのデータ取得は行わない
- `LogListPage` 側の `useState` 遅延初期化で `readOnliveLocalLog(roomId)` を呼び出す
- 最大 1 件のみ表示（同一ルームの最新ログで上書き）
- キー: `watchlog:saved-log:{roomId}`（`getOnliveLocalLogKey(roomId)` で生成）

### JSONビューアログ（JSONインポート、全ユーザー共通）

- **ファイル**: [lib/onlive-local-log.ts](../lib/onlive-local-log.ts)
- `LogListPage` でインポートした JSON ファイルの内容を一時保存する
- キー: `watchlog:json-viewer`（固定）
- 保存タイミング: `LogListPage` でファイル選択・バリデーション成功後
- 取得タイミング: `JsonImportViewerPage` のマウント時

**提供関数：**

| 関数 | 説明 |
|------|------|
| `getOnliveLocalLogKey(roomId)` | `watchlog:saved-log:{roomId}` を返す（エクスポート済み） |
| `readOnliveLocalLog(roomId)` | ローカルストレージから `OnliveLocalLog` を読み込む |
| `writeOnliveLocalLog(roomId, log)` | ローカルストレージに `OnliveLocalLog` を書き込む |
| `deleteOnliveLocalLog(roomId)` | ローカルストレージから `OnliveLocalLog` を削除する |
| `readJsonViewerLog()` | ローカルストレージから `JsonViewerLog` を読み込む |
| `writeJsonViewerLog(log)` | ローカルストレージに `JsonViewerLog` を書き込む |
| `isValidJsonViewerLog(value)` | 値が `JsonViewerLog` 型かを検証する型ガード |

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

### LogDownloadPayload

```typescript
// components/logs/log-list-page.tsx
type LogDownloadPayload = {
  capturedAt: string;           // ISO 8601 文字列（UTC）
  liveId: string;
  log: Record<string, unknown>; // 完全なログペイロード
  roomId: string;
};
```

`GET /api/onlive/logs/{logId}` のレスポンスと同じ構造です。ダウンロード JSON ファイルはこの型の内容がインデント 2 スペースで出力されます。

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

### OnliveLocalLog（ローカルストレージ、非プレミアム）

```typescript
// lib/onlive-local-log.ts
type OnliveLocalLog = {
  capturedAt: string;           // JST ISO 文字列
  commentCount: number;
  giftCount: number;
  liveId: string;
  liveRankingCount: number;
  log: Record<string, unknown>; // 完全なログペイロード（閲覧・ダウンロードで使用）
  roomId: string;
  roomName: string | null;
  savedAt: string;              // JST ISO 文字列
};
```

ローカルストレージキー: `watchlog:saved-log:{roomId}`

### JsonViewerLog（JSONインポートビューア、全ユーザー共通）

```typescript
// lib/onlive-local-log.ts
type JsonViewerLog = {
  capturedAt: string;           // ISO 8601 文字列
  liveId: string;
  log: Record<string, unknown>; // 完全なログペイロード
  roomId: string;
};
```

ローカルストレージキー: `watchlog:json-viewer`（固定）

`LogDownloadPayload`（ダウンロード JSON）と同じ構造。ダウンロードした JSON ファイルをインポートして閲覧する際に使用する。`isValidJsonViewerLog()` でバリデーションを行い、`capturedAt`・`liveId`・`roomId` が文字列、`log` がオブジェクトであることを確認する。

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
| ダウンロード失敗（API エラー・例外） | エラーを無視してサイレントに終了（`downloadingLogId` は `finally` でリセット） |

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/logs/page.tsx](../app/logs/page.tsx) | ログ一覧ページ（認証・データ取得） |
| [app/logs/[logId]/page.tsx](../app/logs/%5BlogId%5D/page.tsx) | DB ログ詳細ページ（管理者・プレミアム） |
| [app/logs/local/[roomId]/page.tsx](../app/logs/local/%5BroomId%5D/page.tsx) | ローカルログ詳細ページ（非プレミアム） |
| [app/logs/json-import/page.tsx](../app/logs/json-import/page.tsx) | JSON インポートビューアページ（全ユーザー共通） |
| [components/logs/log-list-page.tsx](../components/logs/log-list-page.tsx) | ログ一覧 UI・JSON インポート・ダウンロード・削除操作 |
| [components/logs/local-log-viewer-page.tsx](../components/logs/local-log-viewer-page.tsx) | ローカルログ閲覧 UI（非プレミアム） |
| [components/logs/json-import-viewer-page.tsx](../components/logs/json-import-viewer-page.tsx) | JSON インポートログ閲覧 UI（全ユーザー共通） |
| [app/api/onlive/logs/route.ts](../app/api/onlive/logs/route.ts) | ログ保存 API（プレミアム専用） |
| [app/api/onlive/logs/[logId]/route.ts](../app/api/onlive/logs/%5BlogId%5D/route.ts) | ログ取得（GET）・削除（DELETE）API |
| [lib/onlive-log.ts](../lib/onlive-log.ts) | ログ DB 操作・集計 |
| [lib/onlive-local-log.ts](../lib/onlive-local-log.ts) | ローカルストレージログ読み書き・JSON インポートログ読み書き |
| [lib/authz.ts](../lib/authz.ts) | 管理者判定・プレミアム判定（`hasPremiumRole`） |
| [lib/user-registered-room.ts](../lib/user-registered-room.ts) | 登録ルーム取得 |
| [lib/jst.ts](../lib/jst.ts) | JST 日時変換ユーティリティ |
