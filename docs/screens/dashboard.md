# ダッシュボード画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/dashboard` |
| レンダリング | Client Component |
| 認証要否 | 必要 |
| ページタイトル | WatchLog（ルートレイアウトのデフォルト） |

登録したSHOWROOMルームの現在状態をリアルタイムで確認できる画面です。ルームプロフィール・統計情報・開催中イベント・お知らせをまとめて表示し、WebSocket接続で配信開始を自動検知します。

---

## アクセス制御

アクセス制御はクライアントサイドで実施します。ページマウント時（`useEffect`）に `GET /api/dashboard` を呼び出し、レスポンスの `status` に応じて動作を決定します。

| 条件 | 動作 |
|------|------|
| フェッチエラー（ネットワーク障害・HTTP エラー・401 等） | `/search` へ `router.replace()` |
| `status: "no_room"`（登録ルームなし） | `/search` へ `router.replace()` |
| `status: "is_live"`（すでに配信中） | `/onlive` へ `router.replace()` |
| `status: "ok"` | ダッシュボードを表示 |

> `AbortError`（コンポーネントアンマウント時のキャンセル）はリダイレクトせず処理を終了します。

データ取得中（`canShowDashboard = false`）はスケルトン UI を表示し、`null` を返すことはしません。

---

## 画面レイアウト

### 読み込み中（スケルトン）

```
┌────────────────────────────────────────────────────────┐
│ [サイドバー]  ┌──────────────────────────────────────┐ │
│              │  █████████████████████ (HeroSkeleton) │ │
│              └──────────────────────────────────────┘ │
│              ┌──────┐ ┌──────┐ ┌──────┐              │
│              │ ████ │ │ ████ │ │ ████ │  (Stats×6)   │
│              │ ████ │ │ ████ │ │ ████ │              │
│              └──────┘ └──────┘ └──────┘              │
│              ┌──────────────────────────────────────┐ │
│              │ ████  EventSkeleton                  │ │
│              └──────────────────────────────────────┘ │
│              ┌──────────────────────────────────────┐ │
│              │ 🔔 お知らせ  [読み込み中]             │ │
│              │ ████ (skeleton ×3)                   │ │
│              └──────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 読み込み完了

```
┌────────────────────────────────────────────────────────┐
│ [サイドバー]  ┌──────────────────────────────────────┐ │
│              │ [公式/フリー枠] ルーム画像             │ │
│              │  ルーム名（グラデーションオーバーレイ）│ │
│              └──────────────────────────────────────┘ │
│              ┌──────────┐┌──────────┐┌──────────┐    │
│              │👥フォロワー││❤️ファン  ││⭐レベル  │    │
│              │  N 人    ││  N 人    ││  N Lv   │    │
│              └──────────┘└──────────┘└──────────┘    │
│              ┌──────────┐┌──────────┐┌──────────┐    │
│              │🕐配信予定 ││🏆SHOWランク││🏷ジャンル │    │
│              │ yyyy年…  ││  S-3(…)  ││  ○○     │    │
│              └──────────┘└──────────┘└──────────┘    │
│              ┌──────────────────────────────────────┐ │
│              │ 開催中のイベント    [参加中]           │ │
│              │ [イベント画像] イベント名              │ │
│              │               現在順位・ポイント等    │ │
│              └──────────────────────────────────────┘ │
│              ┌──────────────────────────────────────┐ │
│              │ 🔔 お知らせ  [N件]                   │ │
│              │ 1. タイトル       yyyy/MM/DD HH:mm   │ │
│              │    本文テキスト                       │ │
│              └──────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 状態管理

状態はページコンポーネント直下（`Page` 関数）で管理します。

| state 変数 | 型 | 初期値 | 説明 |
|------------|----|----|------|
| `canShowDashboard` | `boolean` | `false` | スケルトンから本体への切り替えフラグ |
| `dashboardData.isAdmin` | `boolean` | `false` | 管理者フラグ（AppShell・WebSocket 制御に使用） |
| `dashboardData.isPremium` | `boolean` | `false` | プレミアムユーザーフラグ（AppShell に渡す） |
| `dashboardData.profile` | `RoomProfile \| null` | `null` | ルームプロフィール |
| `dashboardData.activeFan` | `ActiveFanSummary \| null` | `null` | アクティブファン情報 |
| `dashboardData.eventAndSupport` | `EventAndSupportSummary \| null` | `null` | イベント・サポート情報 |
| `dashboardData.notices` | `AppNotice[]` | `[]` | お知らせ一覧 |
| `dashboardData.noticesHasError` | `boolean` | `false` | お知らせ取得失敗フラグ |

---

## コンポーネント構成

### ページ

- **ファイル**: [app/dashboard/page.tsx](../app/dashboard/page.tsx)
- **種別**: Client Component (`"use client"`)

**初期化フロー**（`useEffect` 内）:
1. `AbortController` をセットアップ
2. localStorage キャッシュを確認し、有効なキャッシュがあれば即座に `setDashboardData`（部分更新）と `setCanShowDashboard(true)` を呼び出して先行表示
3. `setTimeout(0)` で非同期初期化を遅延キック（キャッシュの有無に関わらず必ず `GET /api/dashboard` を呼び出す）
4. `GET /api/dashboard` を呼び出し
5. レスポンスの `status` に応じてリダイレクト or データセット
6. `status: "ok"` の場合、`setDashboardData` → `setCanShowDashboard(true)` → `profile`・`activeFan`・`notices`・`noticesHasError` を localStorage にキャッシュ
7. 管理者でなく `broadcastKey` があれば WebSocket 接続開始

**localStorage キャッシュ**:

| 定数 | 値 | 説明 |
|------|----|------|
| `DASHBOARD_CACHE_KEY` | `"watchlog_dashboard"` | キャッシュキー |
| `DASHBOARD_CACHE_TTL_MS` | `24 * 60 * 60 * 1000`（24時間） | キャッシュ有効期間 |

キャッシュに保存されるフィールドは `profile`・`activeFan`・`notices`・`noticesHasError` のみです（`eventAndSupport` はキャッシュしません）。

```typescript
type DashboardCache = Pick<DashboardData, "profile" | "activeFan" | "notices" | "noticesHasError"> & {
  cachedAt: number;
};
```

- `readDashboardCache()`: localStorage から `DashboardCache` を読み込み、TTL 超過の場合は `null` を返す
- `writeDashboardCache(data)`: `profile`・`activeFan`・`notices`・`noticesHasError` を `cachedAt: Date.now()` と共に localStorage に保存（書き込みエラーは無視）
- プライベートブラウジング・容量超過時は書き込みを無視して通常動作を継続

**クリーンアップ**（`useEffect` 返り値）:
- `isActive = false` でコールバックを無効化
- `controller.abort()` でフェッチをキャンセル
- WebSocket をクローズ、Ping インターバルをクリア

---

### HeroCard

ルームのヒーロー画像とルーム名を表示するカード。

| 要素 | 説明 |
|------|------|
| 背景画像 | `profile.roomImageUrl`（未取得時は Unsplash のフォールバック画像） |
| グラデーション | 左側から黒→透明のオーバーレイ |
| バッジ | `isOfficial` が `true` のとき「公式枠ルーム」、`false` のとき「フリー枠ルーム」 |
| ルーム名 | `profile.roomName`（未取得時は「ルーム情報を取得できませんでした」） |

**高さ**: h-56 / sm:h-72 / lg:h-80

**スケルトン**: `HeroCardSkeleton` — 同高さの `Skeleton` ブロック

---

### RoomStatsSection

6種類の統計情報を `StatsCard` グリッドで表示するセクション。

**グリッドレイアウト**: 1列 / sm:2列 / xl:3列

| # | タイトル | 値の形式 | アイコン | 取得失敗時 |
|---|----------|---------|---------|-----------|
| 1 | フォロワー数 | `{followerNum} 人` | Users | 「取得できませんでした」 |
| 2 | `activeFan.fanName` または「アクティブファン」 | `{totalUserCount} 人` | Heart | 「取得できませんでした」 |
| 3 | ルームレベル | `{roomLevel} Lv` | Star | 「取得できませんでした」 |
| 4 | 次回配信予定 | `{currentLiveStartedAt}` の JST フォーマット または「未定」 | Clock3 | 「未定」 |
| 5 | SHOWランク | `{showRankSubdivided}`（`showRankTimeCharge` があれば `（¥X,XXX/1時間）`を付加） | Trophy | 「取得できませんでした」 |
| 6 | ジャンル | `{genreName}` | Tag | 「取得できませんでした」 |

**スケルトン**: `RoomStatsSectionSkeleton` — `StatsCardSkeleton` を 6 個並べたグリッド

**日時フォーマット** (`formatTime`): Unix 秒 → JST `YYYY年MM月DD日（曜日） HH時MM分`

---

### EventOverviewCard

開催中のイベントまたはサポートの概要を表示するカード。`event` と `support` が両方 `null` の場合は **何も表示しない**（`null` を返す）。

| 要素 | 表示条件 | 内容 |
|------|---------|------|
| カードタイトル | event あり | 「開催中のイベント」（support のみのとき空文字） |
| バッジ | event あり | 「参加中」（support のみのとき空文字） |
| 名前ラベル | 常に | event あり→「イベント名」、support のみ→「サポート名」 |
| イベント/サポート名 | 常に | `event.name` または `support.name` |
| 画像 | 常に | `event.imageUrl`（なければ Unsplash のフォールバック画像）、`eventUrl` がある場合はリンク付き |
| 現在順位 | 常に | `ranking.rank 位`（ranking がなければ「順位情報はありません」） |
| 現在のポイント | 常に | `ranking.point pt`（1位のとき「2位との差 gap pt」、それ以外「次順位まで gap pt」）（ranking がなければ「ポイント情報はありません」） |
| 開始日時 | 常に | `event.startAt` の JST フォーマット（event がなければ「未定」） |
| 終了日時 | 常に | `event.endAt` の JST フォーマット（event がなければ「未定」） |

**スケルトン**: `EventOverviewCardSkeleton` — 画像エリア・イベント名エリア・4つのスタットボックスのスケルトン

---

### NoticeListCard

ダッシュボード向けのお知らせカード。

- **ファイル**: [components/notices/notice-list-card.tsx](../components/notices/notice-list-card.tsx)
- ページからは直接 `NoticeListCard` をインポートして使用する

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `notices` | `AppNotice[]` | お知らせ一覧 |
| `hasError` | `boolean` | 取得失敗フラグ |

**バッジ表示**:

| 状態 | バッジ |
|------|--------|
| 正常取得 | `{件数}件` |
| 取得失敗 | 「取得失敗」 |

**コンテンツ表示**:

| 状態 | 表示内容 |
|------|---------|
| `hasError = true` | 「お知らせを取得できませんでした / 時間をおいて再読み込みしてください。」（ローズ色） |
| `notices.length === 0` | 「公開中のお知らせはありません。」 |
| 通知あり | 番号・タイトル・日時・本文（`whitespace-pre-line`）・リンク（`こちら`） |

**読み込みスケルトン**: `NoticeListLoadingCard` — バッジ「読み込み中」+3件分のスケルトン

---

## API エンドポイント

### GET /api/dashboard

- **ファイル**: [app/api/dashboard/route.ts](../app/api/dashboard/route.ts)
- **認証**: 必要
- **キャッシュ制御**: `force-dynamic`

**処理フロー**:
1. セッションからユーザーID を取得（なければ 401）
2. 登録ルームを取得（なければ `status: "no_room"` を返す）
3. 管理者判定（`hasTopAdminRole`）
4. 以下の5つを `Promise.allSettled` で並行実行:
   - `getRoomProfile(roomId)` — SHOWROOM ルームプロフィール API
   - `getRoomActiveFan(roomId)` — SHOWROOM アクティブファン API
   - `getRoomEventAndSupport(roomId)` — SHOWROOM イベント・サポート API
   - `getDashboardNotices()` — DB からお知らせ取得
   - `getRoomStatus(roomUrl)` — SHOWROOM ルームステータス API
5. `isLive` を判定（`profile.isOnlive === true || roomStatus.isLive === true`）
6. レスポンスを返す

**レスポンス（正常）**:

```json
{
  "status": "ok",
  "isAdmin": false,
  "isPremium": true,
  "registeredRoom": { "roomId": "123456", "roomUrl": "room_key" },
  "profile": { ... },
  "activeFan": { ... },
  "eventAndSupport": { ... },
  "notices": [ ... ],
  "noticesHasError": false,
  "roomStatus": { ... }
}
```

**レスポンス（配信中）**:

```json
{
  "status": "is_live",
  ...同上...
}
```

**レスポンス（ルーム未登録）**:

```json
{ "status": "no_room" }
```

**エラーレスポンス**:

| ステータス | 条件 |
|---------|------|
| 401 | 未認証 |

> 各 SHOWROOM API の失敗は `Promise.allSettled` で吸収し、該当フィールドを `null` として返します。お知らせ取得失敗のみ `noticesHasError: true` を設定します。

---

## SHOWROOM API 連携

ダッシュボード BFF が呼び出す外部 SHOWROOM API の一覧です（`lib/showroom/room.ts`, `lib/showroom/core.ts`）。

| 関数 | SHOWROOM API エンドポイント | クエリパラメータ |
|------|--------------------------|--------------|
| `getRoomProfile(roomId)` | `GET /api/room/profile` | `room_id` |
| `getRoomActiveFan(roomId)` | `GET /api/active_fan/room` | `room_id`, `ym`（YYYYMM） |
| `getRoomEventAndSupport(roomId)` | `GET /api/room/event_and_support` | `room_id` |
| `getRoomStatus(roomUrl)` | `GET /api/room/status` | `room_url_key` |

すべて `cache: "no-store"` で取得し、Accept-Language ヘッダーに `ja-JP` を指定しています。

**画像 URL 変換**: `toLargeImageUrl()` — `_s.` または `_m.` を `_l.` に置換して大サイズ画像を取得します。

**SHOWランク時間チャージマップ** (`RANK_TIME_CHARGE_MAP`):

| ランク | チャージ額/1時間 |
|--------|---------------|
| SS-5 | ¥10,000 |
| SS-4 | ¥6,600 |
| SS-3 | ¥5,000 |
| SS-2 | ¥4,300 |
| SS-1 | ¥3,600 |
| S-5 | ¥3,300 |
| S-4 | ¥2,700 |
| S-3 | ¥2,000 |
| S-2 | ¥1,300 |
| S-1 | ¥1,000 |
| A-5 | ¥830 |
| A-4 | ¥770 |
| A-3 | ¥730 |
| A-2 | ¥700 |
| A-1 | ¥670 |
| B-5 | ¥30 |
| B-4 以下 | 非表示（`null`） |

---

## WebSocket 接続（ライブ開始監視）

配信開始をリアルタイムに検知するため、SHOWROOM の WebSocket サーバーに接続します。

**接続条件**: 管理者でない（`isAdmin = false`）かつ `roomStatus.broadcastKey` が存在する場合のみ接続します。

| 項目 | 値 |
|------|-----|
| 接続先 | `wss://online.showroom-live.com/` |
| 購読メッセージ | `SUB\t{broadcastKey}` |
| Ping メッセージ | `PING\tshowroom` |
| Ping 間隔 | 60 秒（`DASHBOARD_SOCKET_PING_INTERVAL_MS = 60_000`） |
| 配信開始メッセージタイプ | `104`（`SHOWROOM_LIVE_STARTED_MESSAGE_TYPE`） |
| メッセージフォーマット | `MSG\t{broadcastKey}\t{JSON}` |

**配信開始検知フロー**:
1. メッセージを受信し `MSG\t{broadcastKey}\t` プレフィックスを確認
2. JSON をパースして `t` フィールドが `104` か確認
3. 一致すれば `navigateFromDashboard("/onlive")` を呼び出し

**エラー・異常終了時**: `window.location.reload()` でページをリロードします（`shouldReloadOnSocketClose` フラグで制御）。

---

## エラーハンドリング

| エラー種別 | 処理 |
|----------|------|
| `/api/dashboard` 呼び出し失敗（ネットワークエラー等） | `/search` へリダイレクト |
| `status: "no_room"`（未認証 or 登録ルームなし） | `/search` へリダイレクト |
| `status: "is_live"`（すでに配信中） | `/onlive` へリダイレクト |
| SHOWROOM API 失敗（profile/activeFan/eventAndSupport/roomStatus） | 当該フィールドを `null` として画面を継続表示 |
| お知らせ取得失敗 | `noticesHasError: true` を設定し、エラー表示付きで画面を継続表示 |
| WebSocket 接続エラー / 予期せぬクローズ | `window.location.reload()` |
| コンポーネントアンマウント（クリーンアップ） | fetch をキャンセル、WebSocket をクローズ、Ping インターバルをクリア |

---

## 型定義

### DashboardData

```typescript
// types/pages/dashboard.ts
type DashboardData = {
  isAdmin: boolean;
  isPremium: boolean;
  profile: RoomProfile | null;
  activeFan: ActiveFanSummary | null;
  eventAndSupport: EventAndSupportSummary | null;
  notices: AppNotice[];
  noticesHasError: boolean;
};
```

### DashboardBffResponse

```typescript
type DashboardBffOkPayload = {
  status: "ok" | "is_live";
  isAdmin: boolean;
  isPremium: boolean;
  registeredRoom: { roomId: string; roomUrl: string };
  profile: RoomProfile | null;
  activeFan: ActiveFanSummary | null;
  eventAndSupport: EventAndSupportSummary | null;
  notices: AppNotice[];
  noticesHasError: boolean;
  roomStatus: RoomStatus | null;
};

type DashboardBffResponse =
  | { status: "no_room" }
  | DashboardBffOkPayload;
```

### RoomProfile

```typescript
// lib/showroom/room.ts
type RoomProfile = {
  roomId: number;
  roomUrlKey: string;
  roomName: string;
  roomImageUrl: string;
  isOnlive: boolean;
  premiumRoomType: number;
  followerNum: string;      // toLocaleString 済み
  viewNum: number | null;
  genreName: string;
  isOfficial: boolean;
  roomLevel: string;        // toLocaleString 済み
  leagueLabel: string;
  showRankSubdivided: string;
  showRankTimeCharge: string | null;
  nextShowRankSubdivided: string;
  currentLiveStartedAt: number | null;  // Unix 秒
};
```

### ActiveFanSummary

```typescript
type ActiveFanSummary = {
  fanName: string;
  totalUserCount: string;   // toLocaleString 済み
};
```

### EventAndSupportSummary

```typescript
type EventAndSupportSummary = {
  event: {
    id: number;
    name: string;
    imageUrl: string;
    startAt: number;    // Unix 秒
    endAt: number;      // Unix 秒
    eventUrl: string;
  } | null;
  support: {
    id: number;
    name: string;
  } | null;
  ranking: {
    rank: number;
    beforeRank: number;
    point: string;      // toLocaleString 済み
    gap: string;        // toLocaleString 済み
  } | null;
};
```

### RoomStatus

```typescript
type RoomStatus = {
  broadcastHost: string | null;
  broadcastKey: string | null;
  broadcastPort: number | null;
  isLive: boolean;
  liveStatus: number | null;
  roomId: number | null;
  roomUrlKey: string;
};
```

### DashboardStat

```typescript
type DashboardStat = {
  title: string;
  value: string;
  icon: LucideIcon;
};
```

---

## お知らせデータ取得

- **関数**: `getDashboardNotices()` ([lib/dashboard-notices.ts](../lib/dashboard-notices.ts))
- **取得条件**:
  - `displayTarget: AUTHENTICATED or ALL`
  - `publishedAt <= 現在時刻（JST）`
  - `expiresAt is null OR expiresAt > 現在時刻（JST）`
- **ソート**: `publishedAt DESC`, `createdAt DESC`
- **フィールド**: `id, title, content, publishedAt, linkUrl`
- **日時フォーマット**: `YYYY/MM/DD HH:mm`（JST）
- **リンク URL 検証**: `normalizeNoticeLinkUrl()` — `http:` または `https:` のみ許可、それ以外は `null`

---

## その他の注意事項

### メンテナンス制御

ルートレイアウト ([app/layout.tsx](../app/layout.tsx)) でメンテナンスウィンドウを確認し、メンテナンス中の場合は `/maintenance` へリダイレクトします。ダッシュボードも対象です。

### 管理者の特別扱い

`isAdmin = true`（`hasTopAdminRole` が `true`）のユーザーは WebSocket 接続が行われません。通常ユーザーと同様にダッシュボードを閲覧できます。

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [app/dashboard/page.tsx](../app/dashboard/page.tsx) | ページコンポーネント・全サブコンポーネント・WebSocket 制御 |
| [app/api/dashboard/route.ts](../app/api/dashboard/route.ts) | ダッシュボード BFF API |
| [app/layout.tsx](../app/layout.tsx) | ルートレイアウト（メンテナンスチェック・デフォルトメタデータ） |
| [components/notices/notice-list-card.tsx](../components/notices/notice-list-card.tsx) | お知らせ表示・スケルトン |
| [components/navigation/app-sidebar.tsx](../components/navigation/app-sidebar.tsx) | AppShell・ナビゲーション |
| [lib/showroom/room.ts](../lib/showroom/room.ts) | SHOWROOM API クライアント（profile/activeFan/event/status） |
| [lib/showroom/core.ts](../lib/showroom/core.ts) | SHOWROOM API URL・共通 fetch ユーティリティ |
| [lib/showroom-realtime.ts](../lib/showroom-realtime.ts) | WebSocket 定数・メッセージパーサー |
| [lib/dashboard-notices.ts](../lib/dashboard-notices.ts) | お知らせ DB 取得・URL 検証 |
| [lib/user-registered-room.ts](../lib/user-registered-room.ts) | 登録ルーム取得 |
| [lib/authz.ts](../lib/authz.ts) | 管理者判定 |
| [types/pages/dashboard.ts](../types/pages/dashboard.ts) | ダッシュボード型定義 |
