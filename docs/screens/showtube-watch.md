# ShowTube（視聴）画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/showtube/watch?room_id={roomId}` |
| レンダリング | Server Component（`force-dynamic`） |
| 認証要否 | 必要（未認証時は `/` へリダイレクト） |
| 権限要否 | `admin` または `premiumuser` ロール（不足時は `/dashboard` へリダイレクト） |
| ページタイトル | `視聴 \| ShowTube \| WatchLog` |
| ナビゲーション | `ShowTubeShell`（サイドバー・ヘッダー） |

SHOWROOM の特定ルームをライブ視聴する画面です。HLS プレイヤーで動画を再生し、WebSocket でリアルタイムコメントを受信します。

---

## アクセス制御

アクセス制御はサーバーサイドで実施します。

| 条件 | 動作 |
|------|------|
| セッションなし（未認証） | `/` へ `redirect()` |
| `admin` ロールなし かつ `premiumuser` ロールなし | `/dashboard` へ `redirect()` |
| `room_id` パラメータなし または数値でない | `/showtube` へ `redirect()` |
| `admin` または `premiumuser` ロールあり かつ `room_id` が有効 | 画面を表示 |

---

## 画面レイアウト

### デスクトップ（lg 以上）— 配信中

```
┌────────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌──────────────────────────────────────────────┐ │
│ │ ← 戻る       │ │ [≡]  ShowTube                   v3.0.0-β   │ │
│ │ ▶ ShowTube   │ └──────────────────────────────────────────────┘ │
│ │ ────────     │ ┌──────────────────────────────┐ ┌────────────┐ │
│ │ ジャンル     │ │                              │ │ コメント   │ │
│ │ Genre1      │ │   [動画プレイヤー              │ │ ● 接続中  │ │
│ │ Genre2      │ │    aspect-video               │ │ ────────  │ │
│ │             │ │    HLS / autoplay]            │ │ 名前:テキ │ │
│ │ ────────    │ │                              │ │ 名前:テキ │ │
│ │[ログアウト]  │ └──────────────────────────────┘ │ ...       │ │
│ └──────────────┘                                  └────────────┘ │
│                   画質: [低] [中] [高]    [← 一覧へ戻る]         │
│                   ┌────────────────────────────────────────────┐ │
│                   │ ルーム名                                    │ │
│                   │ # roomId    👁 視聴者数                    │ │
│                   │ テロップテキスト（任意）                    │ │
│                   │ [ジャンル名]  [カラオケ]                    │ │
│                   └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### モバイル（lg 未満）— 配信中

```
┌────────────────────────────────────────────┐
│ [≡]  ShowTube                  v3.0.0-β   │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │ [動画プレイヤー (aspect-video)]         │ │
│ └────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────┐ │
│ │ コメント                 ● 接続中      │ │
│ │ ─────────────────────────────────────  │ │
│ │ 名前: コメントテキスト                  │ │
│ │ 名前: コメントテキスト                  │ │
│ │ （h-72 固定・スクロール可）             │ │
│ └────────────────────────────────────────┘ │
│ 画質: [低] [中] [高]                       │
│ ┌────────────────────────────────────────┐ │
│ │ ルーム名                               │ │
│ │ # roomId    👁 視聴者数               │ │
│ │ [ジャンル名]  [カラオケ]               │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

### オフライン（配信なし・room_id に対応するルームが見つからない）

```
┌────────────────────────────────────────────┐
│               📡                           │
│       配信が見つかりません                   │
│  ルーム ID {roomId} の配信は終了している     │
│     か、存在しません。                       │
│         [← 一覧へ戻る]                     │
└────────────────────────────────────────────┘
```

---

## レスポンシブ対応

| ブレークポイント | コメントパネル | 動画レイアウト |
|---|---|---|
| モバイル（lg 未満） | 動画下に固定高さ `h-72`（`CommentPanelMobile`） | 縦積み |
| デスクトップ（lg 以上） | 動画右に幅 `w-80`（`CommentPanelDesktop`）、高さは動画に同期 | 横並び |

---

## データフロー

```
リクエスト受信
  └─ auth() → セッション取得
       ├─ userId なし → redirect("/")
       └─ userId あり
            └─ hasTopAdminRole / hasPremiumRole を並列実行
                 ├─ 両方 false → redirect("/dashboard")
                 └─ いずれか true
                      └─ searchParams.room_id を取得・parseInt
                           ├─ roomId が null または NaN → redirect("/showtube")
                           └─ roomId が有効
                                └─ 以下を Promise.allSettled で並列実行:
                                     1. getOnlives()            → ジャンル一覧・ルーム情報
                                     2. getHlsStreamingUrls()   → HLS URL 一覧
                                     3. getRoomCommentLog()     → 初期コメントログ
                                     4. getRoomLiveInfo()       → bcsvr_key
                                          ↓
                                     各 API 失敗時はフォールバック値を使用:
                                     onlives=null / streamingUrls=[] / initialComments=[] / bcsvrKey=null
                                          ↓
                                     ShowTubeShell + ShowTubeWatchPage レンダリング
```

---

## SHOWROOM API 連携

| 関数 | エンドポイント | パラメータ | キャッシュ | 用途 |
|------|-------------|---------|---------|------|
| `getOnlives()` | `GET /api/live/onlives` | なし | `no-store` | ジャンル一覧・ルーム情報（item）取得 |
| `getHlsStreamingUrls(roomId)` | `GET /api/live/streaming_url` | `room_id`, `abr_available=1` | `no-store` | HLS URL 一覧取得 |
| `getRoomCommentLog(roomId)` | `GET /api/live/comment_log` | `room_id` | `no-store` | 初期コメントログ取得 |
| `getRoomLiveInfo(roomId)` | `GET /api/live/live_info` | `room_id` | `no-store` | `bcsvr_key` 取得 |

HLS URL は `type === "hls"` または `type === "hls_all"` のみ抽出し、`quality` 昇順でソート。

---

## WebSocket リアルタイムコメント受信（`useComments`）

### 接続

| 項目 | 値 |
|------|-----|
| 接続先 | `wss://online.showroom-live.com/` |
| 接続条件 | `bcsvrKey` が `null` でないこと |
| 購読メッセージ | `SUB\t{bcsvrKey}` |
| Ping メッセージ | `PING\tshowroom` |
| Ping 間隔 | 60 秒（`PING_INTERVAL_MS = 60_000`） |

### 接続ステータス（`WsStatus`）

| 状態 | 遷移タイミング |
|------|--------------|
| `"connecting"` | 初期値（`bcsvrKey` が存在する場合） |
| `"connected"` | WebSocket `open` イベント発火時 |
| `"disconnected"` | WebSocket `close` イベント発火時、または `bcsvrKey = null` の初期値 |

### メッセージ処理

受信メッセージを `getShowroomSocketPayloadText(event.data, bcsvrKey)` でペイロード抽出後、JSON パース。

| フィールド | 処理 |
|-----------|------|
| `t` | `1` のメッセージのみ処理（コメントメッセージ）。それ以外は無視 |
| `cm` | コメントテキスト（空の場合はスキップ） |
| `ac` | 投稿者名（空の場合は `"Unknown"`） |
| `u` | ユーザーID |
| `av` | アバターID |
| `cl` | クラスレベル |
| `created_at` | コメント投稿時刻（`null` の場合は `Math.floor(Date.now() / 1000)` を使用） |

新着コメントの ID 生成形式:

```
ws-{userId}-{createdAt}-{Math.random()}
```

### コメント保持件数

コメントは最大 `MAX_COMMENTS = 300` 件保持。超過した場合は古いコメントを先頭から削除。

### エラーハンドリング

| イベント | 処理 |
|---------|------|
| `error` | `ws.close()` を呼び出す |
| `close` | `wsStatus = "disconnected"` / Ping タイマーをクリア |
| JSON パース失敗 | 無視（`catch` で握りつぶし） |

---

## コンポーネント構成

### ShowTubeWatchPage

- **ファイル**: [components/showtube/showtube-watch-page.tsx](../../components/showtube/showtube-watch-page.tsx)
- **種別**: Client Component (`"use client"`)

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `item` | `OnliveItem \| null` | ルーム情報（`null` の場合はオフライン表示） |
| `roomId` | `number` | ルームID |
| `streamingUrls` | `HlsStreamingUrl[]` | HLS ストリーミング URL 一覧 |
| `initialComments` | `RoomComment[]` | 初期コメントログ |
| `bcsvrKey` | `string \| null` | WebSocket 購読キー |

**デフォルト選択画質**: `quality === 0` のアイテム。存在しない場合は `urls[0]`。

---

### HlsPlayer

**再生ライブラリ**: `hls.js`

| 条件 | 動作 |
|------|------|
| `Hls.isSupported() = true` | `new Hls({ enableWorker: true })` でロードし `video` にアタッチ |
| `Hls.isSupported() = false` | `video.canPlayType("application/vnd.apple.mpegurl")` で判定し `video.src` に直接セット |

`<video>` 属性: `controls`、`autoPlay`、`playsInline`

URL 変更時（`key={selectedUrl}`）に `HlsPlayer` を再マウントして再生をリセット。

---

### QualitySelector

`HlsStreamingUrl[]` の各要素をボタンとして表示。

| 状態 | スタイル |
|------|---------|
| 選択中（`option.id === selectedId`） | `bg-slate-900 text-white` |
| 非選択 | `bg-slate-100 text-slate-600`、ホバーで `bg-slate-200` |

`streamingUrls.length === 0` または `selectedId === null` の場合は画質セクション非表示。

---

### CommentPanelDesktop（PC 用コメントパネル）

- 表示条件: `lg:flex`（lg 未満は `hidden`）
- 幅: `w-80`（固定）
- 高さ: `videoRef` の `clientHeight` を `ResizeObserver` で監視し同期
- `height` が `null` の間は `style` 未設定

**自動スクロール**:

- 初回: `height` 確定時（`initialScrolledRef.current = false` のとき）に `scrollTo({ top: el.scrollHeight })`
- 新着コメント時: 下端から 48px 以内（`autoScrollRef.current = true`）の場合 `scrollTo({ behavior: "smooth" })`
- 手動スクロールで 48px より上にいる場合は自動スクロールを停止

---

### CommentPanelMobile（モバイル用コメントパネル）

- 表示条件: `lg:hidden`（lg 以上は非表示）
- 高さ: `h-72`（固定）
- 自動スクロール: Desktop と同じロジック（初回スクロールなし）

---

### WsStatusBadge

| `status` | 表示テキスト | スタイル | ドット |
|----------|------------|---------|------|
| `"connecting"` | 接続中... | `bg-amber-50 text-amber-700` | `animate-pulse bg-amber-400` |
| `"connected"` | 接続中 | `bg-green-50 text-green-700` | `bg-green-500` |
| `"disconnected"` | 切断 | `bg-slate-100 text-slate-500` | `bg-slate-400` |

---

### RoomOffline（オフライン表示）

`item = null` の場合に表示するフォールバック UI。

| 要素 | 内容 |
|------|------|
| アイコン | `Radio`（slate-300） |
| タイトル | 「配信が見つかりません」 |
| 説明 | 「ルーム ID {roomId} の配信は終了しているか、存在しません。」 |
| ボタン | 「← 一覧へ戻る」（`/showtube` へリンク） |

---

## ルーム情報表示

動画・コメントパネルの下に表示するカード。

| 要素 | 表示条件 | 内容 |
|------|---------|------|
| ルーム名 | 常時 | `item.mainName` |
| ルームID | 常時 | `# {item.roomId}` |
| 視聴者数 | 常時 | `{item.viewNum.toLocaleString()}` |
| テロップ | `item.telop` が存在する場合 | テロップテキスト（`bg-slate-50` 背景） |
| ジャンル名バッジ | 常時 | `item.genreName` |
| カラオケバッジ | `item.isKaraoke === true` の場合 | 「カラオケ」（`bg-indigo-100 text-indigo-700`） |

---

## 型定義

### HlsStreamingUrl

```typescript
// lib/showroom/streaming.ts
type HlsStreamingUrl = {
  id: number;
  label: string;
  quality: number;
  url: string;
};
```

### RoomComment

```typescript
// lib/showroom/live.ts
type RoomComment = {
  id: string;
  avatarId: number | null;
  avatarUrl: string | null;
  classLevel: number | null;
  createdAt: number | null;
  name: string;
  text: string;
  userId: string | null;
};
```

### RoomLiveInfo

```typescript
// lib/showroom/live.ts
type RoomLiveInfo = {
  bcsvrKey: string | null;
  liveId: string | null;
  liveStatus: number | null;
};
```

### WsStatus（コンポーネント内ローカル型）

```typescript
// components/showtube/showtube-watch-page.tsx
type WsStatus = "connecting" | "connected" | "disconnected";
```

### RealtimeMessage（コンポーネント内ローカル型）

```typescript
// components/showtube/showtube-watch-page.tsx
type RealtimeMessage = {
  t?: number | string | null;
  cm?: string | null;
  ac?: string | null;
  u?: number | string | null;
  av?: number | string | null;
  cl?: number | string | null;
  created_at?: number | string | null;
};
```

---

## 定数

| 定数名 | 値 | 定義場所 |
|-------|-----|---------|
| `MAX_COMMENTS` | `300` | `components/showtube/showtube-watch-page.tsx` |
| `PING_INTERVAL_MS` | `60_000` | `components/showtube/showtube-watch-page.tsx` |
| `SHOWROOM_SOCKET_URL` | `"wss://online.showroom-live.com/"` | `lib/showroom-realtime.ts` |
| `SHOWROOM_SOCKET_PING_MESSAGE` | `"PING\tshowroom"` | `lib/showroom-realtime.ts` |

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| [app/showtube/watch/page.tsx](../../app/showtube/watch/page.tsx) | ページエントリーポイント・認証・データ取得 |
| [components/showtube/showtube-watch-page.tsx](../../components/showtube/showtube-watch-page.tsx) | 視聴メインコンポーネント（HLS・WebSocket・コメント） |
| [components/showtube/showtube-shell.tsx](../../components/showtube/showtube-shell.tsx) | レイアウトシェル・サイドバー・ヘッダー |
| [lib/showroom/streaming.ts](../../lib/showroom/streaming.ts) | HLS URL 取得・型定義 |
| [lib/showroom/live.ts](../../lib/showroom/live.ts) | コメントログ・ライブ情報取得・型定義 |
| [lib/showroom/onlives.ts](../../lib/showroom/onlives.ts) | オンライブ一覧取得（ルーム情報取得に使用） |
| [lib/showroom/core.ts](../../lib/showroom/core.ts) | SHOWROOM API URL・共通 fetch ユーティリティ |
| [lib/showroom-realtime.ts](../../lib/showroom-realtime.ts) | WebSocket 定数・メッセージパーサー |
| [lib/authz.ts](../../lib/authz.ts) | ロール判定（admin / premiumuser） |
