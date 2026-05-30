# 管理者メンテナンス設定画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/admin/maintenance` |
| レンダリング | Server Component（ページ）+ Client Component（UI） |
| 認証要否 | 必要 |
| 権限要否 | `admin` ロール（不足時は `/dashboard` へリダイレクト） |
| ページタイトル | `メンテナンス設定 \| WatchLog` |

メンテナンスウィンドウを作成・編集・削除する管理者専用画面です。有効なメンテナンスウィンドウが存在する期間中、ユーザーは `/maintenance` へリダイレクトされます。

---

## アクセス制御

| 条件 | 動作 |
|------|------|
| 未ログイン | `/` へリダイレクト |
| `admin` ロールなし | `/dashboard` へリダイレクト |
| `admin` ロールあり | メンテナンス設定一覧を表示 |

---

## 画面レイアウト

```
┌────────────────────────────────────────────────────────────────┐
│ [サイドバー]  メンテナンス設定 N件          [新規作成]           │
│              ┌──────────────────────────────────────────────┐  │
│              │ [アクティブ]  タイトル          [編集] [削除]   │  │
│              │  YYYY/MM/DD HH:mm 〜 YYYY/MM/DD HH:mm        │  │
│              │  メッセージ（最大2行、任意）                    │  │
│              ├──────────────────────────────────────────────┤  │
│              │ [予定]  タイトル                [編集] [削除]   │  │
│              ├──────────────────────────────────────────────┤  │
│              │ [無効]  タイトル                [編集] [削除]   │  │
│              └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## コンポーネント構成

### ページ

- **ファイル**: [app/admin/maintenance/page.tsx](../app/admin/maintenance/page.tsx)
- **種別**: Server Component (async)
- **キャッシュ制御**: `force-dynamic`
- **AppShell**: `activeKey="admin-maintenance"`, `isAdmin=true`

**処理フロー**:
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `hasTopAdminRole(userId)` で管理者判定、非管理者なら `/dashboard` へリダイレクト
3. `listAllMaintenanceWindows()` で全メンテナンスウィンドウを `startsAt DESC, createdAt DESC` で取得
4. `toJstWallTimeIsoString` で各日時を JST ISO 文字列に変換
5. `<MaintenancePage initialWindows={items}>` をレンダリング

**取得フィールド**:
- `id`, `title`, `message`, `startsAt`, `endsAt`, `isEnabled`, `createdAt`, `updatedAt`

### MaintenancePage

- **ファイル**: [components/admin/maintenance-page.tsx](../components/admin/maintenance-page.tsx)
- **種別**: Client Component (`"use client"`)

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `initialWindows` | `MaintenanceItem[]` | 初期メンテナンスウィンドウ一覧 |

**型定義（MaintenanceItem）**:

```typescript
type MaintenanceItem = {
  id: string;
  title: string;
  message: string | null;
  startsAt: string;    // JST ISO 文字列
  endsAt: string;      // JST ISO 文字列
  isEnabled: boolean;
  createdAt: string;   // JST ISO 文字列
  updatedAt: string;   // JST ISO 文字列
};
```

### 各メンテナンスウィンドウ行

| 要素 | 説明 |
|------|------|
| ステータスバッジ | `getWindowStatus()` で算出（下記参照） |
| タイトル | `window.title` |
| 期間 | `{startsAt} 〜 {endsAt}` — `YYYY/MM/DD HH:mm` 形式 |
| メッセージ | `message` がある場合のみ表示（最大2行、`line-clamp-2`） |
| 編集ボタン | `Pencil` アイコン — 編集ダイアログを開く |
| 削除ボタン | `Trash2` アイコン（赤）— 削除確認ダイアログを開く |

**ステータスバッジ（`getWindowStatus`）**:

| ステータス | 条件 | バッジ色 |
|-----------|------|---------|
| `"disabled"` | `isEnabled = false` | amber |
| `"expired"` | `now >= endsAt` | slate |
| `"upcoming"` | `now < startsAt` | blue |
| `"active"` | 上記以外（期間内かつ有効） | emerald |

---

## 作成・編集ダイアログ

`Dialog` コンポーネントを使用。新規作成ボタン押下または編集ボタン押下で開く。

**フォームフィールド**:

| フィールド | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| タイトル | 必須 | `"システムメンテナンス"` | テキスト入力 |
| 開始日時 | 必須 | — | `datetime-local` 入力 |
| 終了日時 | 必須 | — | `datetime-local` 入力 |
| メッセージ | 任意 | — | テキストエリア（4行）、空欄可 |
| 有効にする | — | `true` | `Switch` トグル |

**送信時の処理**:
- 新規作成: `POST /api/admin/maintenance`
- 編集: `PATCH /api/admin/maintenance/{id}`
- 成功時: 一覧を更新してダイアログを閉じる
- 失敗時: フォーム内にエラーメッセージを表示

---

## 削除ダイアログ

`AlertDialog` コンポーネントを使用。削除ボタン押下で開く。

- 「タイトル」を削除しますか？（元に戻せない旨を表示）
- 確定: `DELETE /api/admin/maintenance/{id}`、成功時に一覧から削除
- キャンセル: ダイアログを閉じる

---

## API エンドポイント

### GET /api/admin/maintenance

- **ファイル**: [app/api/admin/maintenance/route.ts](../app/api/admin/maintenance/route.ts)
- **認証・権限**: `requireTopAdminRole()`

**レスポンス（200）**:

```json
{ "maintenanceWindows": [ /* MaintenanceItem[] */ ] }
```

---

### POST /api/admin/maintenance

- **ファイル**: [app/api/admin/maintenance/route.ts](../app/api/admin/maintenance/route.ts)
- **認証・権限**: `requireTopAdminRole()`

**リクエストボディ**:

```json
{
  "title": "string",
  "message": "string" | null,
  "startsAt": "YYYY-MM-DDTHH:mm",
  "endsAt": "YYYY-MM-DDTHH:mm",
  "isEnabled": true
}
```

**バリデーション**:
- `title`: 必須・空文字不可
- `startsAt`, `endsAt`: 必須・JST 日時文字列
- `endsAt > startsAt` であること
- `isEnabled`: 省略時 `true`

**内部処理（トランザクション）**:
1. `MaintenanceWindow` レコードを作成
2. 監査ログ記録（`maintenance_window.create`）

**レスポンス（201）**:

```json
{ "maintenanceWindow": { /* MaintenanceItem */ } }
```

---

### PATCH /api/admin/maintenance/{id}

- **ファイル**: [app/api/admin/maintenance/[id]/route.ts](../app/api/admin/maintenance/%5Bid%5D/route.ts)
- **認証・権限**: `requireTopAdminRole()`

**リクエストボディ**: すべてのフィールドが省略可能（部分更新）

**内部処理（トランザクション）**:
1. 対象レコードの存在確認（存在しなければ 404）
2. 日時バリデーション（既存値と合わせて `endsAt > startsAt` を確認）
3. `MaintenanceWindow` を更新
4. 監査ログ記録（`maintenance_window.update`）

**レスポンス（200）**:

```json
{ "maintenanceWindow": { /* MaintenanceItem */ } }
```

---

### DELETE /api/admin/maintenance/{id}

- **ファイル**: [app/api/admin/maintenance/[id]/route.ts](../app/api/admin/maintenance/%5Bid%5D/route.ts)
- **認証・権限**: `requireTopAdminRole()`

**内部処理（トランザクション）**:
1. 対象レコードの存在確認（存在しなければ 404）
2. `MaintenanceWindow` を削除
3. 監査ログ記録（`maintenance_window.delete`）

**レスポンス（200）**:

```json
{ "id": "cuid..." }
```

**共通エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 400 | リクエストボディが無効・バリデーションエラー |
| 401 | 未認証 |
| 403 | `admin` ロールなし |
| 404 | 対象レコードが存在しない |
| 500 | DB エラー |

---

## データモデル

### MaintenanceWindow

```prisma
model MaintenanceWindow {
  id        String   @id @default(cuid())
  title     String
  message   String?
  startsAt  DateTime @map("starts_at")
  endsAt    DateTime @map("ends_at")
  isEnabled Boolean  @default(true) @map("is_enabled")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

---

## メンテナンスフロー

メンテナンスウィンドウの有効化によってユーザーがリダイレクトされる仕組みは `app/layout.tsx` が担います。

```
管理者がメンテナンスウィンドウを作成（isEnabled=true）
  │
  ▼ ユーザーがページにアクセス
app/layout.tsx
  │  getActiveMaintenanceWindow() で有効期間中のウィンドウを検出
  │  現在のパスが /maintenance でなければ
  └─ /maintenance へリダイレクト
```

`getActiveMaintenanceWindow()` の条件:
- `isEnabled = true`
- `startsAt <= now`
- `endsAt > now`

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/admin/maintenance/page.tsx](../app/admin/maintenance/page.tsx) | ページ（認証・データ取得・レンダリング） |
| [components/admin/maintenance-page.tsx](../components/admin/maintenance-page.tsx) | メンテナンス設定 UI・CRUD 操作 |
| [app/api/admin/maintenance/route.ts](../app/api/admin/maintenance/route.ts) | GET（一覧）・POST（作成）API |
| [app/api/admin/maintenance/[id]/route.ts](../app/api/admin/maintenance/%5Bid%5D/route.ts) | PATCH（更新）・DELETE（削除）API |
| [lib/maintenance.ts](../lib/maintenance.ts) | `listAllMaintenanceWindows()` / `getActiveMaintenanceWindow()` |
| [app/layout.tsx](../app/layout.tsx) | メンテナンス検出・強制リダイレクト |
| [app/maintenance/page.tsx](../app/maintenance/page.tsx) | メンテナンス画面 |
| [lib/authz.ts](../lib/authz.ts) | 管理者権限判定 |
| [lib/audit.ts](../lib/audit.ts) | 監査ログ記録 |
| [lib/jst.ts](../lib/jst.ts) | JST 日時変換・パース |
| [prisma/schema.prisma](../../prisma/schema.prisma) | `MaintenanceWindow` モデル |
