# ルーム検索画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/search` |
| レンダリング | Client Component |
| 認証要否 | 必要（未認証は `/` へリダイレクト） |
| 備考 | 登録ルームがすでにある場合は `/dashboard` へリダイレクト |

SHOWROOM のルームを検索し、招待コードを使用して自分のルームとして登録する画面です。新規ユーザーのオンボーディングフローの一部を担います。

---

## アクセス制御

| 条件 | 動作 |
|------|------|
| 登録ルームあり | `/dashboard` へ `router.replace()` でクライアントリダイレクト |
| 登録ルームなし | ルーム検索画面を表示 |

アクセス制御はクライアントサイドで実施します。ページ初期化時（`useEffect`）に `GET /api/registered-room` を呼び出し、登録済みルームがあれば `/dashboard` へリダイレクトします。チェック中は画面を表示せず（`null` を返す）、チェック完了後に検索画面を表示します。

---

## 画面レイアウトと遷移

### フェーズ 1: 招待コード入力（モーダル）

画面を開くと最初に招待コード入力モーダルが表示されます。

```
┌─────────────────────────────────┐
│ 🔑 招待コードを入力              │
│    ルーム登録には招待コードが     │
│    必要です。                    │
│                                 │
│  [      招待コード入力欄       ]  │
│                                 │
│  10桁の英数字を入力してください。 │
│  ※ エラー時は残り回数を表示      │
│                                 │
│         [  確認  ]               │
└─────────────────────────────────┘
```

### フェーズ 2: ルーム検索

招待コード認証後、ルーム検索エリアが表示されます。

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  [ 検索キーワード入力                        ] [  検索  ]  │
│                                                           │
│  検索結果: N件                                            │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ サムネイル│ │ サムネイル│ │ サムネイル│ │ サムネイル│    │
│  │          │ │          │ │          │ │          │    │
│  │ ルーム名 │ │ ルーム名 │ │ ルーム名 │ │ ルーム名 │    │
│  │ ID: xxx  │ │ ID: xxx  │ │ ID: xxx  │ │ ID: xxx  │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### フェーズ 3: ルーム登録確認（モーダル）

ルームカードをクリックすると確認モーダルが表示されます。

```
┌─────────────────────────────────┐
│  登録しますか？                  │
│                                 │
│  ○○○のルーム を登録します。     │
│                                 │
│  ルームID  123456              │
│  ルームURL https://...         │
│                                 │
│           [いいえ]  [はい]      │
└─────────────────────────────────┘
```

---

## 状態管理

| state 変数 | 型 | 初期値 | 説明 |
|------------|----|----|------|
| `query` | `string` | `""` | 検索キーワード入力値 |
| `results` | `RoomResult[]` | `[]` | 検索結果一覧 |
| `searchedKeyword` | `string` | `""` | 直前に検索したキーワード |
| `selectedRoom` | `RoomResult \| null` | `null` | 登録確認中のルーム |
| `isLoading` | `boolean` | `false` | 検索 API 呼び出し中フラグ |
| `errorMessage` | `string \| null` | `null` | 検索エラーメッセージ |
| `verifiedInviteCode` | `string \| null` | `null` | 検証済みの招待コード |
| `inviteCodeErrorMessage` | `string \| null` | `null` | 招待コード検証エラーメッセージ |
| `isInviteCodeSubmitting` | `boolean` | `false` | 招待コード送信中フラグ |
| `registerErrorMessage` | `string \| null` | `null` | ルーム登録エラーメッセージ |

---

## コンポーネント構成

### ページ

- **ファイル**: [app/search/page.tsx](../app/search/page.tsx)
- **種別**: Client Component (`"use client"`)

**ページコンポーネント構成**:
- `ShowroomRoomSearchPage`: 外側のページコンポーネント。マウント時に `fetchRegisteredRoom()` でルーム登録状態を確認し、登録済みなら `/dashboard` へリダイレクト。チェック中は `null` を返す（`canShowSearch` フラグで制御）。
- `RoomSearchBody`: 状態管理・API 呼び出し・UI レンダリングを担うサブコンポーネント。全状態変数はこのコンポーネントで管理。

**AppShell の設定**: `activeKey="search"` / `showMenu={false}`（ナビゲーションメニューを非表示）

### サブコンポーネント（同ファイル内定義）

#### SearchArea

検索入力欄と検索ボタンを含むエリア。

| 要素 | 説明 |
|------|------|
| 入力フィールド | キーワード入力（`<Input>`） |
| 検索ボタン | Submit ボタン（Search アイコン付き） |
| ローディング表示 | 検索中はスピナーを表示 |

#### InvitationCodeModal

招待コードの入力・検証を行うモーダル。画面前面に固定表示（`z-120`）。

| 要素 | 説明 |
|------|------|
| タイトル | 「招待コードを入力」 |
| 説明文 | 「ルーム登録には招待コードが必要です。」 |
| コード入力欄 | 英数字10文字（`maxLength={10}`、自動大文字変換、`font-mono`） |
| ガイドテキスト | 通常時「10桁の英数字を入力してください。」 |
| エラーメッセージ | 失敗時「招待コードが正しくありません。残りN回入力できます。」 |
| BAN メッセージ | BAN 時「招待コードの入力に3回失敗したため、アカウントがBANされました。」 |
| 確認ボタン | コード送信・検証（送信中はスピナー表示） |

**失敗カウントの管理**:
- 失敗回数はサーバー側（DB の `users.invite_code_failure_count`）で管理
- 3回失敗（`INVITE_CODE_BAN_THRESHOLD = 3`）で自動 BAN
- 検証成功時はカウントをサーバー側でリセット
- BAN 発生時は `/banned` へリダイレクト

#### ConfirmRegisterModal

選択したルームの登録確認ダイアログ。

| 要素 | 説明 |
|------|------|
| タイトル | 「登録しますか？」 |
| 説明文 | `{roomName || roomUrl} を登録します。` |
| ルームID | `<dl>` 要素で表示 |
| ルームURL | `<dl>` 要素で表示（長い場合は truncate） |
| 「いいえ」ボタン | キャンセル（モーダルを閉じる） |
| 「はい」ボタン | 登録を実行 |
| Escape キー | キャンセル動作 |

#### RegisterErrorModal

ルーム登録失敗時のエラー表示ダイアログ。タイトル「登録できません」とエラーメッセージを表示し、「OK」ボタンで閉じる（Escape キーも対応）。

#### RoomCard

検索結果の各ルームを表示するカード。

| 要素 | 説明 |
|------|------|
| サムネイル | aspect-video の画像表示 |
| ルーム名 | テキスト表示 |
| ルーム ID | テキスト表示 |
| ルーム URL | テキスト表示 |
| Hover エフェクト | スケールアップ |

#### LoadingGrid

検索中に表示するスケルトン UI。8件分のプレースホルダーを `animate-pulse` で表示。

#### ResultsPanel

検索結果のグリッドレイアウト。

| ブレークポイント | 列数 |
|---------|------|
| デフォルト | 1列 |
| `sm` | 2列 |
| `lg` | 3列 |
| `2xl` | 4列 |

---

## API エンドポイント

### 0. 登録ルーム取得（アクセス制御用）

- **エンドポイント**: `GET /api/registered-room`
- **ファイル**: [app/api/registered-room/route.ts](../app/api/registered-room/route.ts)
- **認証**: 必要

ページ初期化時に呼び出し、登録済みルームの有無を確認します。

**レスポンス**:

```json
{
  "room": {
    "roomId": "123456",
    "roomUrl": "https://...",
    "roomName": "○○のルーム",
    "imageUrl": "https://..."
  }
}
```

登録ルームがない場合は `"room": null` を返します。

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 401 | 未認証 |

---

### 1. ルーム検索

- **エンドポイント**: `GET /api/room/search`
- **ファイル**: [app/api/room/search/route.ts](../app/api/room/search/route.ts)
- **認証**: 不要（公開エンドポイント）

**クエリパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|------------|----|----|------|
| `keyword` | string | ○ | 検索キーワード |

**レスポンス**:

```json
{
  "rooms": [
    {
      "imageUrl": "https://...",
      "roomId": "123456",
      "roomName": "○○のルーム",
      "roomUrl": "https://www.showroom-live.com/..."
    }
  ]
}
```

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 400 | `keyword` パラメータが未指定または空 |

**内部処理**: `lib/showroom/search.ts` の `searchShowroomRooms()` が SHOWROOM 検索ページの HTML をスクレイピングして結果を返す。

---

### 2. 招待コード検証

- **エンドポイント**: `POST /api/invitations/verify`
- **ファイル**: [app/api/invitations/verify/route.ts](../app/api/invitations/verify/route.ts)
- **認証**: 必要

**リクエストボディ**:

```json
{
  "inviteCode": "XXXXXXXXXX"
}
```

**レスポンス（検証成功）**:

```json
{
  "valid": true
}
```

**レスポンス（検証失敗・自動 BAN）**:

```json
{
  "valid": false,
  "banned": true
}
```

**レスポンス（検証失敗・BAN 未達）**:

```json
{
  "valid": false,
  "remainingAttempts": 2
}
```

**検証条件**（`lib/invitations.ts` の `isInvitationCodeAvailable()`）:
- フォーマット: `/^[A-Z0-9]{10}$/`
- `isDeleted = false`
- `usedAt = null`
- `usedByUserId = null`

**失敗時の処理**:
- 検証成功: `users.invite_code_failure_count` を 0 にリセット
- 検証失敗: `users.invite_code_failure_count` をインクリメント
- 失敗回数が閾値（`INVITE_CODE_BAN_THRESHOLD = 3`）に達した場合:
  - `users.is_banned = true` に更新
  - 対象ユーザーの全セッションを削除（即時ログアウト）
  - 監査ログ記録（`user.ban`、`detail.reason: "invite_code_failure"`）

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 401 | 未認証 |

---

### 3. ルーム登録

- **エンドポイント**: `PUT /api/registered-room`
- **ファイル**: [app/api/registered-room/route.ts](../app/api/registered-room/route.ts)
- **認証**: 必要

**リクエストボディ**:

```json
{
  "imageUrl": "https://...",
  "roomId": "123456",
  "roomName": "○○のルーム",
  "roomUrl": "https://www.showroom-live.com/...",
  "inviteCode": "XXXXXXXXXX"
}
```

**レスポンス**:

```json
{
  "room": {
    "roomId": "123456",
    "roomUrl": "https://...",
    "roomName": "○○のルーム",
    "imageUrl": "https://..."
  }
}
```

**内部処理（トランザクション）**:
1. 招待コードを消費（`usedAt`, `usedByUserId` を設定）
2. ユーザーの登録ルームを保存
3. ユーザー向け招待コードを自動生成（最大3件: `USER_INVITATION_CODE_LIMIT = 3`）
4. 監査ログ記録（`room.register`）

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 400 | `roomId`, `roomUrl`, `inviteCode` のいずれかが未指定 |
| 400 | リクエストボディが無効な JSON |
| 401 | 未認証 |
| 409 | 既に自分のルームが登録されている |
| 409 | 同じルームが他のユーザーに登録されている（管理者を除く） |
| 422 | 招待コードが無効（`InvalidInvitationCodeError`） |

---

## データフロー

### 招待コード検証フロー

```
ユーザーが招待コードを入力
  │
  ▼ [確認] クリック
POST /api/invitations/verify
  │
  ├─ valid: true  → verifiedInviteCode に保存、モーダルを閉じる
  ├─ banned: true → BAN メッセージを表示 → /banned へリダイレクト
  └─ valid: false → inviteCodeErrorMessage を表示（残り N 回）
```

### ルーム検索フロー

```
ユーザーがキーワードを入力して検索
  │
  ▼ [検索] クリック
GET /api/room/search?keyword=...
  │
  ├─ 成功 → results に検索結果を設定
  └─ エラー → errorMessage を設定
```

### ルーム登録フロー

```
ユーザーがルームカードをクリック
  │
  ▼ selectedRoom に設定 → ConfirmRegisterModal 表示
  │
  ▼ [はい] クリック
PUT /api/registered-room
  │
  ├─ 成功 → router.replace("/dashboard") でダッシュボードへ
  └─ エラー → registerErrorMessage を設定 → RegisterErrorModal 表示
```

---

## 型定義

### RoomResult

```typescript
// types/pages/search.ts
type RoomResult = {
  imageUrl: string;
  roomId: string;
  roomName: string;
  roomUrl: string;
};
```

### InvitationVerificationResponse

```typescript
// types/pages/search.ts
type InvitationVerificationResponse = {
  valid?: boolean;
  banned?: boolean;
  remainingAttempts?: number;
};
```

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/search/page.tsx](../app/search/page.tsx) | ページコンポーネント・全サブコンポーネント |
| [app/api/room/search/route.ts](../app/api/room/search/route.ts) | ルーム検索 API |
| [app/api/invitations/verify/route.ts](../app/api/invitations/verify/route.ts) | 招待コード検証 API |
| [app/api/registered-room/route.ts](../app/api/registered-room/route.ts) | ルーム登録 API |
| [lib/showroom/search.ts](../lib/showroom/search.ts) | SHOWROOM スクレイピング |
| [lib/invitations.ts](../lib/invitations.ts) | 招待コード管理ロジック |
| [lib/registered-room.ts](../lib/registered-room.ts) | ルーム登録クライアント関数 |
| [types/pages/search.ts](../types/pages/search.ts) | 検索画面の型定義 |
| [types/api/invitations.ts](../types/api/invitations.ts) | 招待 API の型定義 |
| [types/api/registered-room.ts](../types/api/registered-room.ts) | 登録ルーム API の型定義 |
