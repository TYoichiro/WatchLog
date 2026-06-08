# メンテナンス画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/maintenance` |
| レンダリング | Server Component |
| 認証要否 | 不要（未認証でもアクセス可） |
| ページタイトル | `メンテナンス中 \| WatchLog` |

メンテナンス期間中にすべてのページから自動リダイレクトされる全画面メンテナンス通知ページです。メンテナンスウィンドウのタイトル・期間・メッセージを表示します。外部からのナビゲーション操作は持たず、表示専用です。

---

## アクセス制御

### ミドルウェア（`proxy.ts`）

Next.js ミドルウェアで認証状態を検査します。`/maintenance` は未認証ユーザーのアクセスを明示的に許可しています。

| 条件 | 動作 |
|------|------|
| 未認証 かつ `/` または `/maintenance` へのアクセス | 通過（リダイレクトなし） |
| 未認証 かつ上記以外のパス | `/` へリダイレクト |
| 認証済み | 通過 |

### ルートレイアウト（`app/layout.tsx`）

すべてのページレンダリング時に `getActiveMaintenanceWindow()` を実行し、アクティブなメンテナンスウィンドウがあれば強制リダイレクトします。またバン済みユーザーも本レイアウトで強制リダイレクトします。

**メンテナンスチェック**:

| 条件 | 動作 |
|------|------|
| メンテナンスウィンドウが存在する かつ 現在のパスが `/maintenance` 以外 | `/maintenance` へリダイレクト |
| メンテナンスウィンドウが存在しない | リダイレクトなし（通常表示） |

**バンチェック**:

| 条件 | 動作 |
|------|------|
| 現在のパスが `/banned` またはAPIパス（`/api/` から始まる） | チェックをスキップ |
| 認証済みユーザー かつ `user.isBanned = true` | `/banned` へリダイレクト |
| 上記以外 | リダイレクトなし（通常表示） |

バンチェックはメンテナンスチェックの後に実行します。バンされたユーザーのセッションは BAN 操作時に削除されます（`PATCH /api/admin/users/{userId}/ban` 参照）。

> 現在のパスは `proxy.ts` がリクエストヘッダーに設定する `x-watchlog-pathname` ヘッダーから取得します。

### メンテナンスページ自身のリダイレクト

アクティブなメンテナンスウィンドウが存在しない状態で `/maintenance` へ直接アクセスした場合は、`/` へリダイレクトします。

---

## 画面レイアウト

```
┌─────────────────────────────────────────────────────────────┐
│                     bg-slate-100（全画面）                    │
│                                                             │
│         ┌─────────────────────────────────────────┐         │
│         │  bg-white  shadow-sm  max-w-2xl          │         │
│         │                                          │         │
│         │  ┌──────┐  [Maintenance]（Badge）        │         │
│         │  │  🔧  │                                │         │
│         │  │amber │  タイトル（h1）                │         │
│         │  └──────┘                                │         │
│         │           ┌────────────────────────────┐ │         │
│         │           │ 🕐 YYYY年MM月DD日（曜）HH:mm │ │         │
│         │           │    〜YYYY年MM月DD日（曜）HH:mm│ │         │
│         │           │    までメンテナンス中です。  │ │         │
│         │           └────────────────────────────┘ │         │
│         │                                          │         │
│         │  メッセージテキスト（whitespace-pre-line）│         │
│         │                                          │         │
│         └─────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

モバイルではアイコンとコンテンツが縦並び（`flex-col`）、`sm:` 以上では横並び（`sm:flex-row sm:items-start`）になります。

---

## コンポーネント構成

### ページ

- **ファイル**: [app/maintenance/page.tsx](../app/maintenance/page.tsx)
- **種別**: Server Component（`async function`）
- **キャッシュ制御**: `export const dynamic = "force-dynamic"`

**レンダリングフロー**:
1. `getActiveMaintenanceWindow()` を呼び出す
2. 戻り値が `null` の場合は `redirect("/")` でホームへリダイレクト
3. `auth()` でセッション確認し `userId` を取得
4. `userId` がある場合は `hasTopAdminRole(userId)` で管理者判定
5. メンテナンス情報を表示（管理者の場合は `<StopMaintenanceButton>` も表示）

**使用コンポーネント**:

| コンポーネント | 用途 |
|--------------|------|
| `Badge` | 「Maintenance」ラベル（outline、amber） |
| `Wrench`（lucide-react） | メンテナンスアイコン |
| `Clock3`（lucide-react） | 期間表示アイコン |
| `StopMaintenanceButton` | 管理者向けメンテナンス停止ボタン（`isAdmin = true` のときのみ） |

**表示要素**:

| 要素 | 内容 |
|------|------|
| アイコン | `Wrench`（`bg-amber-100 text-amber-700` の角丸コンテナ） |
| Badge | `"Maintenance"`（`border-amber-300 text-amber-700`） |
| タイトル | `maintenanceWindow.title` |
| 期間テキスト | `maintenanceWindow.period` + `" までメンテナンス中です。"` |
| メッセージ | `maintenanceWindow.message` が存在する場合はその値、`null` の場合はデフォルトメッセージ |
| 管理者操作セクション | `isAdmin = true` のとき: 区切り線（`border-t`）の下に `<StopMaintenanceButton windowId={maintenanceWindow.id} />` を表示 |

**デフォルトメッセージ**（`message` が `null` のとき）:
```
ただいまシステムメンテナンスを実施しています。終了後に再度アクセスしてください。
```

### StopMaintenanceButton

- **ファイル**: [components/maintenance/stop-maintenance-button.tsx](../components/maintenance/stop-maintenance-button.tsx)
- **種別**: Client Component (`"use client"`)

管理者専用のメンテナンス停止ボタン。`PATCH /api/admin/maintenance/{windowId}` に `{ isEnabled: false }` を送信し、成功後はルーターをリフレッシュして `/` へ遷移します。

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `windowId` | `string` | 停止対象のメンテナンスウィンドウ ID |

**動作**:
- ボタン押下で `PATCH /api/admin/maintenance/{windowId}` を呼び出し `isEnabled: false` に更新
- 処理中はボタンを `disabled` にして「停止中...」テキストを表示
- 成功後: `router.refresh()` → `router.push("/")`
- 失敗時: エラーメッセージをボタン下に表示（赤文字）

---

## データ取得処理

### `getActiveMaintenanceWindow()`

- **ファイル**: [lib/maintenance.ts](../lib/maintenance.ts)
- **戻り値**: `ActiveMaintenanceWindow | null`

**クエリ条件**（`prisma.maintenanceWindow.findFirst`）:

| 条件 | 内容 |
|------|------|
| `isEnabled = true` | 有効なウィンドウのみ |
| `startsAt <= 現在JST時刻` | 開始済み |
| `endsAt > 現在JST時刻` | 終了前 |

**ソート順**: `startsAt DESC`、`createdAt DESC`（最新のウィンドウを優先）

**SELECT フィールド**: `id`, `title`, `message`, `startsAt`, `endsAt`

**戻り値の加工**:
- `period` フィールドを `formatMaintenancePeriod(startsAt, endsAt)` で生成して付加します

### 期間フォーマット

`formatMaintenancePeriod(startsAt, endsAt)` は以下の形式の文字列を返します:

```
YYYY年MM月DD日（曜）HH:mm〜YYYY年MM月DD日（曜）HH:mm
```

`Intl.DateTimeFormat` の設定:

| オプション | 値 |
|-----------|----|
| `year` | `"numeric"` |
| `month` | `"2-digit"` |
| `day` | `"2-digit"` |
| `weekday` | `"short"` |
| `hour` | `"2-digit"` |
| `minute` | `"2-digit"` |
| `hour12` | `false` |

表示例: `2026年05月11日（日）14:30〜2026年05月11日（日）16:30`

---

## メンテナンス制御フロー

```
[リクエスト]
  │
  ▼ proxy.ts（Next.js ミドルウェア）
  ├─ x-watchlog-pathname ヘッダーを設定
  ├─ 未認証 かつ /maintenance または / → 通過
  └─ 未認証 かつ その他 → / へリダイレクト
  │
  ▼ app/layout.tsx（RootLayout）
  ├─ getActiveMaintenanceWindow() 実行
  ├─ メンテナンスあり かつ pathname ≠ /maintenance
  │    → /maintenance へリダイレクト
  └─ メンテナンスなし or pathname = /maintenance → 通過
  │
  ▼ app/maintenance/page.tsx
  ├─ getActiveMaintenanceWindow() 実行
  ├─ null（メンテナンスなし）→ / へリダイレクト
  └─ 存在する → メンテナンス情報を表示
```

> ルートレイアウトとページの両方で `getActiveMaintenanceWindow()` を呼び出しますが、Next.js の fetch キャッシュにより同一リクエスト内では重複実行されません。

---

## 型定義

### ActiveMaintenanceWindow

```typescript
// lib/maintenance.ts
type ActiveMaintenanceWindow = {
  id: string;
  title: string;
  message: string | null;
  startsAt: Date;
  endsAt: Date;
  period: string; // formatMaintenancePeriod でフォーマット済みの期間文字列
};
```

---

## データベーススキーマ

### `maintenance_windows` テーブル

| カラム | Prisma フィールド | 型 | 制約 | デフォルト値 |
|--------|-----------------|-----|------|-----------|
| `id` | `id` | `String` | PK、CUID | — |
| `title` | `title` | `String` | NOT NULL | `'システムメンテナンス'` |
| `message` | `message` | `String?` | NULL 可、Text | — |
| `starts_at` | `startsAt` | `DateTime` | NOT NULL | — |
| `ends_at` | `endsAt` | `DateTime` | NOT NULL | — |
| `is_enabled` | `isEnabled` | `Boolean` | NOT NULL | `true` |
| `created_at` | `createdAt` | `DateTime` | NOT NULL | `CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'` |
| `updated_at` | `updatedAt` | `DateTime` | NOT NULL, `@updatedAt` | `CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'` |

**インデックス**: `(is_enabled, starts_at, ends_at)` — アクティブウィンドウ検索を高速化

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/maintenance/page.tsx](../app/maintenance/page.tsx) | メンテナンスページコンポーネント |
| [components/maintenance/stop-maintenance-button.tsx](../components/maintenance/stop-maintenance-button.tsx) | 管理者向けメンテナンス停止ボタン |
| [lib/maintenance.ts](../lib/maintenance.ts) | アクティブウィンドウ取得・期間フォーマット |
| [lib/jst.ts](../lib/jst.ts) | JST 変換・日時フォーマット |
| [lib/authz.ts](../lib/authz.ts) | 管理者権限判定（`hasTopAdminRole`） |
| [app/layout.tsx](../app/layout.tsx) | ルートレイアウト（全ページへのメンテナンスリダイレクト） |
| [proxy.ts](../../proxy.ts) | Next.js ミドルウェア（未認証アクセス制御・pathname ヘッダー設定） |
| [prisma/schema.prisma](../../prisma/schema.prisma) | `MaintenanceWindow` モデル定義 |
| [components/ui/badge.tsx](../components/ui/badge.tsx) | Badge UI コンポーネント |
