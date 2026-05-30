# BAN済みユーザー画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/banned` |
| レンダリング | Client Component |
| 認証要否 | 不要（認証済みユーザーがリダイレクトされる） |
| ページタイトル | WatchLog（ルートレイアウトのデフォルト） |

管理者によって BAN されたユーザーがリダイレクトされる画面です。白背景のみを表示し、ナビゲーション・コンテンツは一切持ちません。

---

## アクセス制御

### ルートレイアウトによるリダイレクト（`app/layout.tsx`）

BAN 済みユーザーが任意のページ（`/banned` および API パス以外）へアクセスすると、ルートレイアウトが強制リダイレクトします。

| 条件 | 動作 |
|------|------|
| 現在のパスが `/banned` または `/api/` から始まる | チェックをスキップ |
| 認証済みユーザー かつ `user.isBanned = true` | `/banned` へリダイレクト |
| 上記以外 | リダイレクトなし |

### ミドルウェア（`proxy.ts`）

認証済みユーザーは `request.auth` が truthy のため、`/banned` へのアクセスはミドルウェアを通過します（特別な許可は不要）。

---

## 画面レイアウト

```
┌────────────────────────────────────────────────────────┐
│  bg-white（全画面・コンテンツなし）                      │
└────────────────────────────────────────────────────────┘
```

---

## コンポーネント構成

### ページ

- **ファイル**: [app/banned/page.tsx](../app/banned/page.tsx)
- **種別**: Client Component（`"use client"` なし、デフォルト）

**実装**:

```tsx
export default function BannedPage() {
  return <div className="min-h-screen bg-white" />;
}
```

白背景（`min-h-screen bg-white`）のみを表示します。メッセージ・ナビゲーション・ボタン等は一切含みません。

---

## BAN フロー

```
管理者が UserListPage でユーザーを BAN に変更
  │
  ▼ PATCH /api/admin/users/{userId}/ban  { banned: true }
  │
  ├─ user.isBanned = true に更新
  └─ そのユーザーの全セッションを削除（session.deleteMany）
       │
       ▼ 次回アクセス時
  ルートレイアウト（app/layout.tsx）
       │  isBanned = true を検出
       └─ /banned へリダイレクト
```

BAN されたユーザーはセッションが削除されるため即座にログアウトされます。再ログインしても `/banned` にリダイレクトされ続けます。

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/banned/page.tsx](../app/banned/page.tsx) | BAN 済みユーザーページ |
| [app/layout.tsx](../app/layout.tsx) | BAN チェック・強制リダイレクト |
| [app/api/admin/users/[userId]/ban/route.ts](../app/api/admin/users/%5BuserId%5D/ban/route.ts) | BAN/アンバン API |
| [prisma/schema.prisma](../../prisma/schema.prisma) | `User.isBanned` フィールド |
