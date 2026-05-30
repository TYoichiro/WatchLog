# 管理者お知らせ管理画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/admin/notices` |
| レンダリング | Server Component（ページ）+ Client Component（UI） |
| 認証要否 | 必要 |
| 権限要否 | `admin` ロール（不足時は `/dashboard` へリダイレクト） |
| ページタイトル | `お知らせ管理 \| WatchLog` |

ダッシュボード・ログイン画面向けのお知らせを作成・編集・削除する管理者専用画面です。

---

## アクセス制御

| 条件 | 動作 |
|------|------|
| 未ログイン | `/` へリダイレクト |
| `admin` ロールなし | `/dashboard` へリダイレクト |
| `admin` ロールあり | お知らせ一覧を表示 |

---

## 画面レイアウト

```
┌────────────────────────────────────────────────────────────────┐
│ [サイドバー]  お知らせ管理 N件              [新規作成]           │
│              ┌──────────────────────────────────────────────┐  │
│              │ [公開中] [ログイン後]  タイトル     [編集] [削除] │
│              │  公開: YYYY/MM/DD HH:mm 〜 YYYY/MM/DD HH:mm  │  │
│              │  本文（最大2行）                               │  │
│              │  linkUrl（あれば）                             │  │
│              ├──────────────────────────────────────────────┤  │
│              │ [公開予定] [全員]  タイトル       [編集] [削除] │  │
│              └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## コンポーネント構成

### ページ

- **ファイル**: [app/admin/notices/page.tsx](../app/admin/notices/page.tsx)
- **種別**: Server Component (async)
- **キャッシュ制御**: `force-dynamic`
- **AppShell**: `activeKey="admin-notices"`, `isAdmin=true`

**処理フロー**:
1. `auth()` でユーザーID 確認、なければ `/` へリダイレクト
2. `hasTopAdminRole(userId)` で管理者判定、非管理者なら `/dashboard` へリダイレクト
3. `prisma.dashboardNotice.findMany` で全お知らせを `publishedAt DESC, createdAt DESC` で取得
4. `toJstWallTimeIsoString` で各日時を JST ISO 文字列に変換
5. `<NoticesPage initialNotices={items}>` をレンダリング

**取得フィールド**:
- `id`, `title`, `content`, `displayTarget`, `publishedAt`, `expiresAt`, `linkUrl`, `createdAt`, `updatedAt`

### NoticesPage

- **ファイル**: [components/admin/notices-page.tsx](../components/admin/notices-page.tsx)
- **種別**: Client Component (`"use client"`)

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `initialNotices` | `NoticeItem[]` | 初期お知らせ一覧 |

**型定義（NoticeItem）**:

```typescript
type NoticeItem = {
  id: number;
  title: string;
  content: string;
  displayTarget: "AUTHENTICATED" | "LOGIN" | "ALL";
  publishedAt: string;       // JST ISO 文字列
  expiresAt: string | null;  // JST ISO 文字列
  linkUrl: string | null;
  createdAt: string;         // JST ISO 文字列
  updatedAt: string;         // JST ISO 文字列
};
```

### 各お知らせ行

| 要素 | 説明 |
|------|------|
| ステータスバッジ | `getNoticeStatus()` で算出（下記参照） |
| 表示対象バッジ | `displayTarget` に対応するバッジ（下記参照） |
| タイトル | `notice.title` |
| 公開期間 | `公開: {publishedAt} 〜 {expiresAt}`（`expiresAt` がなければ `〜` 以降なし） |
| 本文 | 最大2行（`line-clamp-2`） |
| リンクURL | `linkUrl` がある場合のみ表示 |
| 編集ボタン | `Pencil` アイコン — 編集ダイアログを開く |
| 削除ボタン | `Trash2` アイコン（赤）— 削除確認ダイアログを開く |

**ステータスバッジ（`getNoticeStatus`）**:

| ステータス | 条件 | バッジ色 |
|-----------|------|---------|
| `"scheduled"` | `now < publishedAt` | amber |
| `"expired"` | `expiresAt` あり かつ `now >= expiresAt` | slate |
| `"publishing"` | 上記以外 | emerald |

**表示対象バッジ（`displayTarget`）**:

| 値 | ラベル | バッジ色 |
|----|--------|---------|
| `AUTHENTICATED` | ログイン後 | blue |
| `LOGIN` | ログイン画面 | purple |
| `ALL` | 全員 | slate |

---

## 作成・編集ダイアログ

`Dialog` コンポーネントを使用。新規作成ボタン押下または編集ボタン押下で開く。

**フォームフィールド**:

| フィールド | 必須 | 説明 |
|-----------|------|------|
| タイトル | 必須 | テキスト入力 |
| 本文 | 必須 | テキストエリア（4行） |
| 表示対象 | 必須 | セレクト（AUTHENTICATED / LOGIN / ALL）、デフォルト `AUTHENTICATED` |
| 公開日時 | 必須 | `datetime-local` 入力 |
| 終了日時 | 任意 | `datetime-local` 入力（空欄可） |
| リンクURL | 任意 | URL 入力（空欄可） |

**送信時の処理**:
- 新規作成: `POST /api/admin/notices`
- 編集: `PATCH /api/admin/notices/{id}`
- 成功時: 一覧を更新してダイアログを閉じる
- 失敗時: フォーム内にエラーメッセージを表示

---

## 削除ダイアログ

`AlertDialog` コンポーネントを使用。削除ボタン押下で開く。

- 「タイトル」を削除しますか？（元に戻せない旨を表示）
- 確定: `DELETE /api/admin/notices/{id}`、成功時に一覧から削除
- キャンセル: ダイアログを閉じる

---

## API エンドポイント

### GET /api/admin/notices

- **ファイル**: [app/api/admin/notices/route.ts](../app/api/admin/notices/route.ts)
- **認証・権限**: `requireTopAdminRole()`

**レスポンス（200）**:

```json
{ "notices": [ /* NoticeItem[] */ ] }
```

---

### POST /api/admin/notices

- **ファイル**: [app/api/admin/notices/route.ts](../app/api/admin/notices/route.ts)
- **認証・権限**: `requireTopAdminRole()`

**リクエストボディ**:

```json
{
  "title": "string",
  "content": "string",
  "displayTarget": "AUTHENTICATED" | "LOGIN" | "ALL",
  "publishedAt": "YYYY-MM-DDTHH:mm",
  "expiresAt": "YYYY-MM-DDTHH:mm" | null,
  "linkUrl": "string" | null
}
```

**バリデーション**:
- `title`, `content`: 必須・空文字不可
- `displayTarget`: `AUTHENTICATED` / `LOGIN` / `ALL` のいずれか（省略時 `AUTHENTICATED`）
- `publishedAt`: 必須・JST 日時文字列
- `expiresAt`: 任意・JST 日時文字列（指定する場合は `publishedAt` より後であること）

**内部処理（トランザクション）**:
1. `DashboardNotice` レコードを作成
2. 監査ログ記録（`dashboard_notice.create`）

**レスポンス（201）**:

```json
{ "notice": { /* NoticeItem */ } }
```

---

### PATCH /api/admin/notices/{id}

- **ファイル**: [app/api/admin/notices/[id]/route.ts](../app/api/admin/notices/%5Bid%5D/route.ts)
- **認証・権限**: `requireTopAdminRole()`

**リクエストボディ**: すべてのフィールドが省略可能（部分更新）

**内部処理（トランザクション）**:
1. 対象レコードの存在確認（存在しなければ 404）
2. 日時バリデーション（既存値と合わせて `expiresAt > publishedAt` を確認）
3. `DashboardNotice` を更新
4. 監査ログ記録（`dashboard_notice.update`）

**レスポンス（200）**:

```json
{ "notice": { /* NoticeItem */ } }
```

---

### DELETE /api/admin/notices/{id}

- **ファイル**: [app/api/admin/notices/[id]/route.ts](../app/api/admin/notices/%5Bid%5D/route.ts)
- **認証・権限**: `requireTopAdminRole()`

**内部処理（トランザクション）**:
1. 対象レコードの存在確認（存在しなければ 404）
2. `DashboardNotice` を削除
3. 監査ログ記録（`dashboard_notice.delete`）

**レスポンス（200）**:

```json
{ "id": 123 }
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

### DashboardNotice

```prisma
model DashboardNotice {
  id            Int                   @id @default(autoincrement())
  title         String
  content       String
  displayTarget DashboardNoticeTarget @default(AUTHENTICATED) @map("display_target")
  publishedAt   DateTime              @map("published_at")
  expiresAt     DateTime?             @map("expires_at")
  linkUrl       String?               @map("link_url")
  createdAt     DateTime              @default(now()) @map("created_at")
  updatedAt     DateTime              @updatedAt @map("updated_at")
}

enum DashboardNoticeTarget {
  AUTHENTICATED
  LOGIN
  ALL
}
```

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/admin/notices/page.tsx](../app/admin/notices/page.tsx) | ページ（認証・データ取得・レンダリング） |
| [components/admin/notices-page.tsx](../components/admin/notices-page.tsx) | お知らせ一覧 UI・CRUD 操作 |
| [app/api/admin/notices/route.ts](../app/api/admin/notices/route.ts) | GET（一覧）・POST（作成）API |
| [app/api/admin/notices/[id]/route.ts](../app/api/admin/notices/%5Bid%5D/route.ts) | PATCH（更新）・DELETE（削除）API |
| [lib/authz.ts](../lib/authz.ts) | 管理者権限判定 |
| [lib/audit.ts](../lib/audit.ts) | 監査ログ記録 |
| [lib/jst.ts](../lib/jst.ts) | JST 日時変換・パース |
| [prisma/schema.prisma](../../prisma/schema.prisma) | `DashboardNotice` モデル・`DashboardNoticeTarget` enum |
