# 設定画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/settings` |
| レンダリング | Server Component (SSR, `force-dynamic`) |
| 認証要否 | 必要 |
| ページタイトル | 設定 \| WatchLog |

ユーザーが自分の招待コードを確認できる画面です。現時点では招待コードの参照のみ提供しています。

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
│  ・ブロック    │ 🔑 招待コード（最大3名まで招待可）     │   │
│  ・設定 ◀━━   │ ──────────────────────────────────── │   │
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
2. `getUserRegisteredRoom(userId)` で登録ルームを確認 → なければ `/search` へリダイレクト
3. `getUserRegisteredRoom()` と `listUserInvitationCodes()` を `Promise.all` で並列取得
4. `<AppShell activeKey="settings">` 内に招待コードカードをレンダリング

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

## 招待コードカード

### カード構成

| 要素 | 説明 |
|------|------|
| アイコン + 見出し | KeyRound アイコン + 「招待コード（最大3名まで招待することができます）」の h2 見出し |
| コード一覧 | `divide-y` で区切り線付きリスト |

### 各コード行

| 要素 | 説明 |
|------|------|
| コード文字列 | `font-mono` で表示（例: `ABCD123456`） |
| ステータスバッジ | Active / 使用済みを色分け表示 |

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

---

## 招待コードの仕組み

招待コードはルーム登録時に自動生成されます（`PUT /api/registered-room` のトランザクション内）。

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
| [lib/user-registered-room.ts](../lib/user-registered-room.ts) | 登録ルームデータ取得 |
| [lib/invitations.ts](../lib/invitations.ts) | 招待コード管理ロジック |
| [components/ui/card.tsx](../components/ui/card.tsx) | Card UI コンポーネント |
| [components/ui/badge.tsx](../components/ui/badge.tsx) | Badge UI コンポーネント |
