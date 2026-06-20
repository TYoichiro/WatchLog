# オンライブ画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/onlive` |
| レンダリング | Client Component（`"use client"`） |
| 認証要否 | 必要（未認証時は API が 401 を返し `/search` へリダイレクト） |
| ページタイトル | `配信中 \| WatchLog` |
| ナビゲーション | `AppShell`（`activeKey="dashboard"`、`showMenu={false}`） |

SHOWROOMの配信をリアルタイムで監視するアプリケーションのメイン機能画面です。WebSocket でコメント・ギフト・通知を受信しながら、60 秒ごとのポーリングでフォロワー数・視聴者数・ランキングを更新します。配信終了時はログを自動保存してダッシュボードへ戻ります。

---

## アクセス制御

アクセス制御はクライアントサイドで実施します。ページマウント時（`useEffect`）に `GET /api/onlive/init` を呼び出し、レスポンスに応じて動作を決定します。

| 条件 | 動作 |
|------|------|
| フェッチエラー（ネットワーク障害・HTTP エラー等） | `/search` へ `router.replace()` |
| `status: "no_room"`（登録ルームなし） | `/search` へ `router.replace()` |
| `status: "ok"` | `OnliveRoomPage` を表示 |

> `AbortError`（コンポーネントアンマウント時のキャンセル）はリダイレクトせず処理を終了します。  
> データ取得中は何も表示しません（`return null`）。

---

## 画面レイアウト

### 読み込み完了（配信中）

```
┌─────────────────────────────────────────────────────────────────────┐
│ [サイドバー非表示]                                                   │
│                                                                     │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│ │ 💎 獲得ポイント│ │ 👥 フォロワー数│ │ 👁 盛り上がり │ │ ⏱ 配信開始時間││
│ │ 約X,XXX pt   │ │ X,XXX 人     │ │ X,XXX        │ │ HH時MM分SS秒 ││
│ │ [有料][無料] │ │ [▲配信開始から]│ │ [▲1分前比]  │ │ YYYY年MM月DD日││
│ │              │ │              │ │              │ │ 経過 HH時... ││
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
│                                                                     │
│ ┌───────────────────────────────┐ ┌───────────────────────────────┐ │
│ │ テロップ：〇〇〇〇〇〇        │ │ ┌─────────────┐┌─────────────┐│ │
│ │───────────────────────────────│ │ │ 無料ギフト  ││ 有料ギフト  ││ │
│ │コメント                        │ │ │─────────────││─────────────││ │
│ │─────────────────────────────  │ │ │[avatar] 名前││[avatar] 名前││ │
│ │[avatar] 名前 | ID | HH時MM分  │ │ │ ギフト名    ││ ギフト名    ││ │
│ │        コメントテキスト        │ │ │ xN / Xpt   ││ xN / Xpt   ││ │
│ │─────────────────────────────  │ │ └─────────────┘└─────────────┘│ │
│ │[avatar] 名前 | ID | HH時MM分  │ │ ┌─────────────┐┌─────────────┐│ │
│ │        コメントテキスト        │ │ │ライブランキング││ 累計ランキング││ │
│ │─────────────────────────────  │ │ │─────────────││─────────────││ │
│ │（スクロール可能）              │ │ │1位 [av] 名前││1位 [av] 名前││ │
│ │                               │ │ │2位 [av] 名前││ XPt N回訪問 ││ │
│ └───────────────────────────────┘ └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### レスポンシブ対応

| ブレークポイント | レイアウト |
|---|---|
| モバイル（xl 未満） | 1カラム。コメントパネル→ギフト・ランキングが縦積み |
| タブレット（sm 以上） | ギフト・ランキングの右半分が 2カラムグリッド |
| デスクトップ（xl 以上） | 左：コメントパネル / 右：2×2グリッド（ギフト×2 ＋ ランキング×2）の横並び。全体が`overflow-hidden`で画面高さ固定 |

---

## 初期化フロー（`OnlivePage`）

```
マウント
  └─ GET /api/onlive/init
       ├─ エラー           → /search へリダイレクト
       ├─ status:"no_room" → /search へリダイレクト
       └─ status:"ok"      → OnliveRoomPage を表示
```

`/api/onlive/init` は `Promise.allSettled` で以下を並列取得します。いずれかが失敗しても残りで継続します。

| 取得内容 | Showroom API | 失敗時 |
|---|---|---|
| ライブ情報（bcsvrKey, liveId, liveStatus, isPremiumLive） | `GET /live_info` | `null` |
| ギフト定義一覧 | `GET /gift_list` | `[]` |
| コメントログ | `GET /comment_log` | `[]` |
| ギフトログ | `GET /gift_log` | `[]` |
| テロップ | `GET /telop` | `null` |

ライブ情報取得後、`isPremiumLive === true` の場合は `getBcsvrKeyFromOnlives(roomId)` を追加呼び出しして `bcsvrKey` を補完します。この呼び出しが失敗した場合は `bcsvrKey` を `null` のままにします（クライアント側でプレミアムライブダイアログを表示します）。

ギフト定義・ギフトログ取得時、プレミアムライブ中は `GET /gift_groups` が error code `1002` を返す場合があります。この場合はフォールバックルーム（ID: `317313`）で再取得します。

ブロックユーザーのコメント・ギフトはレスポンス前にサーバー側でフィルタリングされます。

---

## WebSocket リアルタイムフィード（`useShowroomRealtimeFeed`）

### 接続

| 項目 | 値 |
|---|---|
| URL | `wss://online.showroom-live.com/` |
| 接続トリガー | `liveInfo` が取得できた場合 |
| 接続キャンセル | `liveStatus === 1`（配信外）の場合は接続せず |
| 購読メッセージ | `SUB\t{bcsvr_key}` |
| PING 間隔 | 60 秒（`PING\tshowroom`） |

### メッセージ種別

| `t`（type） | 内容 | 処理 |
|---|---|---|
| `1` | コメント | `normalizeRealtimeComment()` → コメント一覧に追加 |
| `2` | ギフト | `normalizeRealtimeGift()` → ギフトログに追加 |
| `18` | 通知（フォロー・訪問・ファン数等） | `normalizeRealtimeNotice()` → コメント一覧に追加（通知フラグあり） |
| `101` | **配信終了** | `normalizeLiveEndedNotice()` → コメント追加、`isLiveEnded=true`、Socket 切断 |
| `1001` | ランキング通知 | `normalizeRealtimeNotice()` → コメント一覧に追加（`noticeTone: "ranking"`） |

### 通知のトーン分類（`NoticeTone`）

コメント行の背景色と内容は通知タイプによって異なります。

| `noticeTone` | テキストパターン | 背景色 |
|---|---|---|
| `follow` | 〇〇さんがフォローしました！❤ | `bg-rose-50/60` |
| `fanLevel` | 〇〇のファンレベルが X にあがりました！ | `bg-sky-50/70` |
| `fanCount` | 〇〇が X 人になりました！ | `bg-pink-50/70` |
| `firstVisit` | 〇〇さんが初訪問✨ / 2度目の訪問✨ | `bg-sky-50/70` |
| `visit` | 〇〇さんが X 回目の訪問🎉 | `bg-emerald-50/70` |
| `ranking` | ランキング「〇〇」で X 位になりました | `bg-yellow-50/80` |
| その他の通知 | （上記以外の通知） | `bg-rose-50/60` |
| 通常コメント | — | `bg-white` |

### エラーハンドリング

| エラー種別 | 動作 |
|---|---|
| WebSocket `onerror` | `hasFatalError=true` → エラーダイアログを表示 |
| 予期しない Socket 切断 | `hasFatalError=true` → エラーダイアログを表示 |
| PING 送信失敗 | `hasFatalError=true` → エラーダイアログを表示 |
| `bcsvrKey` 未取得（通常ライブ） | `hasFatalError=true` → エラーダイアログを表示 |
| `isPremiumLive === true` かつ `bcsvrKey` 未取得 | WebSocket 接続をスキップして早期リターン（エラーダイアログなし）。クライアントはプレミアムライブダイアログを表示する |

---

## ポーリング（`useOnlivePoll`）

配信終了（`isLiveEnded=true`）まで 60 秒間隔で `GET /api/onlive/poll` を呼び出します。

`useOnlivePoll(isEnabled, skipRanking)` の第 2 引数 `skipRanking` に `true` を渡すと `?skip_ranking=1` クエリを付加し、サーバー側でランキング取得をスキップします。プレミアムライブ時（`initData.liveInfo?.isPremiumLive === true`）は `skipRanking=true` で呼び出します。

| 取得内容 | 用途 |
|---|---|
| `profile`（`RoomProfile`） | フォロワー数・視聴者数・配信開始時刻の更新 |
| `liveRanking`（`RoomLiveRankingUser[]`） | ライブランキングの更新（`skipRanking=true` 時は空配列） |
| `totalRanking`（`RoomTotalRankingUser[]`） | 累計ランキングの更新（`skipRanking=true` 時は空配列） |

- 初回取得値を `initialProfile` に保存し、フォロワー数の増減比較に使用します。
- 前回取得値を `previousProfile` に保存し、視聴者数の増減比較に使用します。
- エラー時はすでに値がある場合は古い値を保持します（初回エラー時のみエラーフラグを立てます）。

---

## ローカルストレージ

### セッション保持（配信中データ）

ページをリロードしても配信中データが失われないよう、セッション情報をローカルストレージに保存します。

| 項目 | 値 |
|---|---|
| キー | `watchlog:onlive:{roomId}` |
| バージョン | `1`（バージョン不一致時は無効化） |
| 保存タイミング | コメント・ギフトが更新されるたびに |
| 削除タイミング | 配信終了ログ保存成功時、`liveStatus===1`（配信外）検出時、ログレスキュー画面での復旧成功時 |

**保存内容：**

```
{
  version: 1,
  roomId: number,
  liveId: string | null,
  savedAt: number (unix ms),
  comments: CommentRow[],
  gifts: RoomGiftLog[],
  metrics: {
    giftTotals: { freePoints, paidPoints, totalPoints },
    initialFollowerNum: string | null,
    latestFollowerNum: string | null,
    latestAudienceNum: number | null,
    previousAudienceNum: number | null
  }
}
```

**復元条件：** 保存された `liveId` が現在の `liveId` と一致する場合のみ復元します。`liveId` が変わった場合（別配信）は破棄します。

### 配信終了ログ（非プレミアム）

非プレミアムユーザーの配信終了後ログを保存します。

| 項目 | 値 |
|---|---|
| キー | `watchlog:saved-log:{roomId}` |
| 保存タイミング | 配信終了時（`isLiveEnded=true` 後の `useEffect`） |
| 保存件数 | 1件のみ（新しいログで上書き） |
| 削除タイミング | ログ一覧画面で削除操作を実行した時 |
| 閲覧 | ログ一覧画面・ログ詳細画面（`/logs/local:{liveId}`）から |

---

## ギフトの重複排除・マージ

### 重複排除

`userId + giftId + createdAt + count + point + totalPoint + isFree` の複合キーで重複を検出し、同一ギフトが複数ソースから来ても 1件のみ表示します。

### 30 秒マージウィンドウ

同一ユーザーが同一ギフトを 30 秒以内に連続して贈った場合、カウントを合算して 1行に表示します（`GIFT_LOG_MERGE_WINDOW_SECONDS = 30`）。

---

## メトリクスカード

ヘッダーに 4 枚のカードを横並びで表示します。

### 1. 獲得ポイント

| 項目 | 内容 |
|---|---|
| アイコン | `Gem`（amber） |
| 値 | `約 X,XXX pt`（有料+無料の合計、リアルタイム加算） |
| サブ値 | 有料 pt / 無料 pt の内訳（2カラム） |
| ローディング | `"..."` |
| エラー | `"--"` |
| 注 | "約"プレフィックスあり（正確な値でない場合があるため） |

### 2. フォロワー数

| 項目 | 内容 |
|---|---|
| アイコン | `Users`（sky） |
| 値 | `X,XXX 人`（ポーリング取得） |
| サブ値 | `MetricDeltaBadge`（配信開始から±X人） |
| ローディング | `"..."` |
| エラー | `"--"` |

### 3. 盛り上がり

| 項目 | 内容 |
|---|---|
| アイコン | `Eye`（emerald） |
| 値 | 視聴者数（ポーリング取得、`viewNum`） |
| サブ値 | `MetricDeltaBadge`（1分前比±X） |
| ローディング | `"..."` |
| エラー | `"--"` |

### 4. 配信開始時間

| 項目 | 内容 |
|---|---|
| アイコン | `Timer`（violet） |
| 値 | `HH時MM分SS秒`（JST、ポーリングの `currentLiveStartedAt` から） |
| サブ値 | `YYYY年MM月DD日` |
| フッター | `Clock3` アイコン + `経過時間 HH時MM分SS秒`（1秒ごとに更新、配信終了まで） |
| ローディング | `"..."` |
| エラー | `"--"` |

### `MetricDeltaBadge` の表示仕様

| 変化 | バッジ色 | アイコン |
|---|---|---|
| 増加（`delta > 0`） | emerald（`bg-emerald-50 text-emerald-700`） | `ArrowUpRight` |
| 減少（`delta < 0`） | rose（`bg-rose-50 text-rose-700`） | `ArrowDownRight` |
| 変化なし / 不明 | slate（`bg-slate-100 text-slate-500`） | `Minus` |

---

## 設定モーダル（`LiveSettingsModal`）

`AppShell` の `headerActions` に歯車アイコンボタン（`Settings`）として配置されます。クリックすると設定ダイアログが開きます。

### 設定項目

| セクション | 設定名 | 内容 |
|---|---|---|
| コメント設定 | お知らせ系通知 | ON のとき通知行（`notice=true`）をコメント一覧に表示する。OFF のとき非表示。デフォルト ON |

`showNotice` ステートは `OnliveRoomPage` が管理し、`CommentPane` に props として渡されます。`filterComments()` 関数が `showNotice=false` のとき `notice=true` のコメント行を除外します。

---

## コメントパネル（`CommentPane`）

### テロップ欄

- 画面上部に amber 背景で常時表示。
- 優先順位：WebSocket からのリアルタイムテロップ → 初期化時取得テロップ → "テロップは設定されていません"。

### コメント一覧

スクロール可能なテーブル形式で、最新コメントが最上段に表示されます（新着が先頭）。

**各行の表示要素：**

| 要素 | 内容 |
|---|---|
| アバター画像 | クリックでプロフィールモーダルを開く（`userId` がある場合） |
| クラスレベル | アバター下に `Class XX`（なければ `Class --`） |
| 訪問ステータスバッジ | 初見（sky）、ビギナー（emerald）、開発者（violet） |
| ユーザー名 | 太字 |
| ユーザー ID | `ID: XXXXXXXX` |
| 時刻 | `HH時MM分SS秒` |
| コメント本文 | — |

**通知行のインタラクション：**  
通知行（`notice=true`）かつ `userId` がある場合、行全体がクリック可能になりプロフィールモーダルが開きます。

**空・エラー状態：**

| 状態 | 表示 |
|---|---|
| 読み込み中 | スケルトン 5行（`animate-pulse`） |
| エラー | rose 背景のエラーメッセージ |
| コメントなし | slate 背景の「コメントはまだありません」 |

---

## ギフトログテーブル（`GiftLogTable`）

無料ギフトと有料ギフトを別カードに分けて表示します。

**各行の表示要素：**

| 要素 | 内容 |
|---|---|
| アバター画像 | クリックでプロフィールモーダルを開く |
| 訪問ステータスバッジ | コメント欄と同仕様 |
| ユーザー名 | 太字 |
| ユーザー ID | `ID: XXXXXXXX` |
| ギフト画像 | `https://image.showroom-cdn.com/showroom-prod/assets/img/gift/{giftId}_s.png` |
| ギフト名 | — |
| ギフト情報 | `x N / X pt / X pt / HH時MM分SS秒` |

行クリックでプロフィールモーダルが開きます。

---

## ランキングテーブル

### ライブランキング（`LiveRankingTable`）

配信中に贈られたギフトポイントの順位です。

| 要素 | 内容 |
|---|---|
| 順位 | `X位` |
| アバター | クリック可能 |
| 訪問ステータスバッジ | — |
| ユーザー名 | — |
| ユーザー ID | — |

エラー時のメッセージは `isPremiumLive` によって変化します。

| 状態 | メッセージ |
|---|---|
| `isPremiumLive === true` | 「プレミアムライブの時はライブランキングの情報を取得する事ができません。」 |
| 通常エラー | 「ライブランキングの情報を取得できませんでした。エラーが発生しました。」 |

### 累計ランキング（`TotalRankingTable`）

ルーム全体の累計ランキングです。

| 要素 | 内容 |
|---|---|
| 順位 | `X位` |
| アバター | クリック可能 |
| 訪問ステータスバッジ | — |
| ユーザー名 | — |
| ユーザー ID | — |
| サブテキスト | `X,XXX pt / N 回訪問` |

エラー時のメッセージは `isPremiumLive` によって変化します。

| 状態 | メッセージ |
|---|---|
| `isPremiumLive === true` | 「プレミアムライブの時は累計ランキングの情報を取得する事ができません。」 |
| 通常エラー | 「累計ランキングの情報を取得できませんでした。エラーが発生しました。」 |

両テーブルとも行クリックでプロフィールモーダルが開きます。

---

## ユーザープロフィールモーダル（`UserProfileModal`）

コメント・ギフト・ランキングのユーザーアバターまたは名前をクリックすると表示されます。  
データは `/api/room/user-profile?room_id={roomId}&user_id={userId}` から取得し、`profileCache` でセッション中にキャッシュします。

**サイズ：** 幅 90vw（デスクトップ 50vw）、高さ 70vh

### タブ切り替え

`roomProfile` が取得できた場合のみタブが表示されます。

| タブ | 内容 |
|---|---|
| ユーザー（デフォルト） | ユーザープロフィール |
| ルーム | ルームプロフィール |

### ユーザータブ

| セクション | 内容 |
|---|---|
| プロフィール画像 | 正方形（`aspect-square`） |
| 開発者バッジ | `DEVELOPER_USER_ID` の場合のみ violet バッジを表示 |
| Avatar | 利用中のアバター画像 |
| SNS リンク | アイコン + 名前 + 外部リンクアイコン |
| SMS 認証状態 | 認証済み（emerald `ShieldCheck`） / 未認証（rose `ShieldX`） |
| ブロックボタン | 赤の Destructive ボタン（開発者・ブロック済みは無効） |
| ファンレベル | amber カード |
| リスナーレベル | sky カード |
| クラスレベル | violet カード |
| ユーザー名 + ID | — |
| プロフィール文 | 改行対応（`whitespace-pre-wrap`） |

**ブロックボタンの状態：**

| 条件 | ラベル | 有効/無効 |
|---|---|---|
| 開発者 | "開発者はブロックできません" | 無効 |
| ブロック済み | "ブロック済み" | 無効 |
| ブロック処理中 | "ブロック中..." | 無効 |
| 通常 | "このユーザーをブロック" | 有効 |

### ルームタブ

| セクション | 内容 |
|---|---|
| ルーム画像 | 正方形 |
| Room Icon | アバター画像 |
| バナー | バナー画像一覧（バナーがある場合のみ表示） |
| SNS リンク | — |
| フォロワー | emerald カード |
| ルームレベル | sky カード |
| 視聴者数 | violet カード |
| リンクボタン | 配信中の場合 "ルームページを開く" / ライブ URL / プロフィール URL |
| 配信状態 | 配信中（rose）/ 配信外（slate） |
| タグ | Official/Free、ジャンル名、リーグ |
| 配信開始時刻 | — |
| 説明文 | — |
| シェアテキスト | 配信中のシェアテキスト（ある場合のみ） |

**モーダルの状態：**

| 状態 | 表示 |
|---|---|
| 読み込み中 | スケルトン UI（画像、メトリクスカード、テキスト） |
| エラー | rose 背景の「プロフィール情報の取得に失敗しました。」 |
| 正常 | 上記コンテンツ |

---

## ダイアログ一覧

### 1. WebSocket 致命的エラーダイアログ

| 項目 | 内容 |
|---|---|
| 表示条件 | `hasRealtimeFatalError === true` |
| タイトル | 「エラーが発生しました」 |
| 説明 | 「再読み込みを行います。」 |
| ボタン | 「OK」→ `window.location.reload()` |
| 閉じる方法 | ボタンのみ（ESC・外側クリック無効） |

### 2. 配信中でないダイアログ

| 項目 | 内容 |
|---|---|
| 表示条件 | WebSocket エラーなし・配信終了なし かつ `liveStatus === 1` または `isOnlive === false` |
| タイトル | 「配信中ではありません」 |
| 説明 | 「現在このルームは配信中ではありません。」 |
| ボタン | 「OK」→ `/dashboard` へ `router.replace()` |

### 3. 配信終了ダイアログ

| 項目 | 内容 |
|---|---|
| 表示条件 | `isLiveEndedDialogOpen === true`（ログ保存成功後） |
| タイトル | 「配信は終了しました」 |
| 説明 | 「配信は終了しました、ダッシュボードに戻ります」 |
| ボタン | 「OK」→ `/dashboard` へ `router.replace()` |
| 閉じる方法 | ボタンのみ（ESC・外側クリック無効） |

### 4. ページレベルエラーダイアログ（`error.tsx`）

Next.js の Error Boundary が捕捉した例外が対象です。

| 項目 | 内容 |
|---|---|
| タイトル | 「エラーが発生しました」 |
| 説明 | 「再読み込みを行います。」 |
| ボタン | 「OK」→ `window.location.reload()` |
| 閉じる方法 | ボタンのみ（ESC・外側クリック無効） |

---

## 配信終了ログ保存フロー

配信終了（`isLiveEnded=true`）後、ユーザーのプレミアム状態に応じて保存先を分岐します。

### プレミアムユーザー（DB 保存）

```
配信終了（WebSocket t=101 受信）
  └─ isLiveEnded = true, liveEndedAt = 設定
       └─ (useEffect) ログキーの重複チェック（savedOnliveLogKeysRef / savingOnliveLogKeysRef）
            └─ isPremium = true の場合:
                 POST /api/onlive/logs
                      ├─ リクエスト: { roomId, liveId, capturedAt, log: OnliveLogPayload }
                      │   log 内容: source, version, capturedAt, savedAt, roomId,
                      │             comments, gifts, liveInfo, metrics, rankings.live,
                      │             roomProfile, localStorageSnapshot
                      ├─ サーバー側: 総合ランキングを追加取得して rankings.total に追加保存
                      ├─ 成功: セッションストレージ削除 → isLiveEndedDialogOpen = true → ダイアログ表示
                      └─ 失敗: コンソールエラーログのみ（ダイアログなし）
```

### 非プレミアムユーザー（ローカルストレージ保存）

```
配信終了（WebSocket t=101 受信）
  └─ isLiveEnded = true, liveEndedAt = 設定
       └─ (useEffect) ログキーの重複チェック（savedOnliveLogKeysRef / savingOnliveLogKeysRef）
            └─ isPremium = false の場合:
                 writeOnliveLocalLog(roomId, OnliveLocalLog)
                      ├─ キー: watchlog:saved-log:{roomId}（同一ルームの直近1件を上書き）
                      ├─ 保存内容: capturedAt, commentCount, giftCount, liveId,
                      │            log（完全ペイロード）, roomId, roomName, savedAt
                      ├─ 成功: セッションストレージ削除 → isLiveEndedDialogOpen = true → ダイアログ表示
                      └─ API 呼び出しなし（ネットワーク不要）
```

ログキー（`{roomId}:{liveId}:{capturedAt}`）で重複保存を防止します（プレミアム・非プレミアム共通）。

`isPremium` は `GET /api/onlive/init` のレスポンスから取得します。

---

## ユーザーブロック機能

### ブロック

プロフィールモーダルのブロックボタンをクリックすると `POST /api/blocks` を呼び出します。  
ブロック後はリアルタイムでコメント・ギフト・ランキングからそのユーザーが除外されます（フィルタリングは `filterBlockedShowroomItems()` がクライアント側で実施）。

### ブロックの適用範囲

| データ | ブロック適用 |
|---|---|
| コメント一覧 | 適用（`visibleLiveComments`） |
| ギフトログ | 適用（`visibleMergedGifts`） |
| ライブランキング | 適用（`visibleLiveRanking`） |
| 累計ランキング | 適用（`totalRanking` を `filterBlockedShowroomItems` でフィルタリング） |

### 除外対象

`DEVELOPER_USER_ID`（`"3699368"`）はブロック対象外です。

---

## 訪問ステータスバッジ（`UserVisitStatusBadge`）

コメント・ギフト・ランキングの各ユーザー名の前に表示されます。

| `userVisitStatus` / `userId` | バッジ | 色 |
|---|---|---|
| `userId === DEVELOPER_USER_ID` かつ `userVisitStatus === 2` | 「開発者（初見）」 | violet |
| `userId === DEVELOPER_USER_ID` かつ `userVisitStatus === 1` | 「開発者（ビギナー）」 | violet |
| `userId === DEVELOPER_USER_ID` | 「開発者」 | violet |
| `userVisitStatus === 2` | 「初見」 | sky |
| `userVisitStatus === 1` | 「ビギナー」 | emerald |
| その他 | 非表示 | — |

---

## API エンドポイント一覧

| メソッド | パス | 用途 |
|---|---|---|
| `GET` | `/api/onlive/init` | 初期データ取得（ライブ情報・コメント・ギフト等） |
| `GET` | `/api/onlive/poll` | 定期ポーリング（プロフィール・ランキング） |
| `POST` | `/api/onlive/logs` | 配信終了ログ保存（プレミアムユーザー専用） |
| `GET` | `/api/onlive/logs/:logId` | ログ取得（ユーザー本人または管理者） |
| `PATCH` | `/api/onlive/logs/:logId` | ログタイトル更新（プレミアムユーザーまたは管理者） |
| `DELETE` | `/api/onlive/logs/:logId` | ログ削除（ソフトデリート） |
| `PUT` | `/api/onlive/logs/:logId/favorite` | ログお気に入りトグル（プレミアムユーザーまたは管理者） |
| `GET` | `/api/room/user-profile` | ユーザープロフィール取得（モーダル用） |

### `GET /api/onlive/init`

**レスポンス（`status: "ok"`）：**

```json
{
  "status": "ok",
  "roomId": 123456,
  "isPremium": true,
  "liveInfo": {
    "bcsvrKey": "...",
    "isPremiumLive": false,
    "liveId": "...",
    "liveStatus": 2
  },
  "giftDefinitions": [...],
  "comments": [...],
  "gifts": [...],
  "telop": "テロップテキスト"
}
```

`isPremium` は `hasPremiumRole(userId)` の結果です。`OnliveRoomPage` がこの値を元にログ保存先（DB / ローカルストレージ）を分岐します。

`liveInfo.isPremiumLive` は Showroom の `/live_info` レスポンスに `redirect_url` が存在する場合に `true` になります。プレミアムライブ時は `liveStatus` が `null`、`bcsvrKey` は `getBcsvrKeyFromOnlives` による補完値（失敗時は `null`）、`liveId` は `live_id` が取得できない場合に `YYYYMMDD` 形式の日付文字列をフォールバックとして設定します。

**レスポンス（登録ルームなし）：**

```json
{ "status": "no_room" }
```

### `GET /api/onlive/poll`

**クエリパラメーター：**

| パラメーター | 値 | 説明 |
|---|---|---|
| `skip_ranking` | `1` | ライブランキング・累計ランキングの取得をスキップする。プレミアムライブ時に使用 |

**レスポンス：**

```json
{
  "profile": { "followerNum": "...", "viewNum": 1234, ... },
  "profileHasError": false,
  "liveRanking": [...],
  "liveRankingHasError": false,
  "totalRanking": [...],
  "totalRankingHasError": false
}
```

`skip_ranking=1` の場合、`liveRanking` / `totalRanking` は空配列、`liveRankingHasError` / `totalRankingHasError` は `true` になります。

### `GET /api/onlive/logs/:logId`

**ユーザー本人または管理者のみ取得可能。** 管理者は全ログを取得できます。

**レスポンス：**

```json
{
  "capturedAt": "2024-01-01T12:00:00+09:00",
  "liveId": "...",
  "log": { ... },
  "roomId": "123456"
}
```

### `PATCH /api/onlive/logs/:logId`

**プレミアムユーザーまたは管理者専用。**

**リクエスト：**

```json
{ "title": "配信タイトル" }
```

`title` が空または省略された場合は `null` としてタイトルをクリアします。

**レスポンス：**

```json
{ "ok": true, "title": "配信タイトル" }
```

### `PUT /api/onlive/logs/:logId/favorite`

**プレミアムユーザーまたは管理者専用。**

リクエストボディなし。お気に入り状態をトグルします（既にお気に入りなら解除、未登録なら追加）。

**レスポンス：**

```json
{ "ok": true, "isFavorite": true }
```

### `POST /api/onlive/logs`

**プレミアムユーザー専用。** 非プレミアムユーザーが呼び出した場合は `403 Forbidden` を返します。

**リクエスト：**

```json
{
  "roomId": "123456",
  "liveId": "...",
  "capturedAt": "2024-01-01T12:00:00+09:00",
  "log": { ... }
}
```

**バリデーション：**

| フィールド | 条件 |
|---|---|
| `roomId` | 空でない文字列、かつユーザーの登録ルームと一致 |
| `liveId` | 空でない文字列 |
| `capturedAt` | JST 壁時間の ISO 文字列 |
| `log` | 有効な JSON オブジェクト |

**サーバー側処理：** クライアントから送られた `log.rankings` に、サーバーで取得した総合ランキング（`total`）を追加します。また `log.server.savedAt` と `log.server.version` を付与します。

**レスポンス：**

```json
{
  "log": {
    "id": "...",
    "capturedAt": "...",
    "updatedAt": "..."
  }
}
```

---

## データモデル（Prisma）

### `OnliveLog`

```
id         String              @id @default(cuid())
roomId     String              @map("room_id")
liveId     String              @map("live_id")
capturedAt DateTime            @map("captured_at")
log        Json
title      String?
isDeleted  Boolean             @default(false) @map("is_deleted")
createdAt  DateTime            @default(dbgenerated(...)) @map("created_at")
updatedAt  DateTime            @default(dbgenerated(...)) @map("updated_at")
favorites  OnliveLogFavorite[]

@@unique([roomId, liveId, capturedAt])
@@index([roomId, liveId])
@@index([roomId, isDeleted, capturedAt])
@@map("onlive_logs")
```

`(roomId, liveId, capturedAt)` の複合ユニーク制約により、同一配信・同一時刻のログ重複保存を防止します（upsert で更新）。

### `OnliveLogFavorite`

```
id        String    @id @default(cuid())
userId    String    @map("user_id")
logId     String    @map("log_id")
createdAt DateTime  @default(dbgenerated(...)) @map("created_at")
user      User      @relation(...)
log       OnliveLog @relation(..., onDelete: Cascade)

@@unique([userId, logId])
@@index([userId, createdAt])
@@map("onlive_log_favorites")
```

ユーザーがログをお気に入り登録するための中間テーブルです。`(userId, logId)` のユニーク制約により 1 ユーザーにつき 1 件のみ登録できます。`PUT /api/onlive/logs/:logId/favorite` でトグル操作します。

### `UserBlock`

```
id                    String   @id @default(cuid())
blockerUserId         String
blockedShowroomUserId String
blockedShowroomUserName String
createdAt             DateTime
updatedAt             DateTime

@@unique([blockerUserId, blockedShowroomUserId])
```

---

## 定数

| 定数名 | 値 | 用途 |
|---|---|---|
| `POLLING_INTERVAL_MS` | `60_000` | ポーリング間隔（ms） |
| `ONLIVE_SOCKET_PING_INTERVAL_MS` | `60_000` | WebSocket PING 間隔（ms） |
| `GIFT_LOG_MERGE_WINDOW_SECONDS` | `30` | ギフトマージウィンドウ（秒） |
| `ONLIVE_LOG_VERSION` | `1` | ログペイロードのバージョン |
| `ONLIVE_STORAGE_VERSION` | `1` | ローカルストレージスキーマのバージョン |
| `ONLIVE_STORAGE_KEY_PREFIX` | `"watchlog:onlive"` | セッション保持用ローカルストレージキーのプレフィックス |
| `ONLIVE_LOCAL_LOG_KEY_PREFIX` | `"watchlog:saved-log"` | 非プレミアム配信終了ログ用ローカルストレージキーのプレフィックス |
| `DEVELOPER_USER_ID` | `"3699368"` | 開発者の Showroom ユーザー ID |
| `SHOWROOM_SOCKET_URL` | `"wss://online.showroom-live.com/"` | WebSocket エンドポイント |

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| [app/onlive/page.tsx](../../app/onlive/page.tsx) | ページエントリーポイント・メタデータ |
| [app/onlive/error.tsx](../../app/onlive/error.tsx) | Next.js エラーバウンダリー |
| [components/onlive/onlive-room-page.tsx](../../components/onlive/onlive-room-page.tsx) | 画面メインコンポーネント（全機能） |
| [components/onlive/live-settings-modal.tsx](../../components/onlive/live-settings-modal.tsx) | 設定モーダル（お知らせ通知トグル） |
| [app/api/onlive/init/route.ts](../../app/api/onlive/init/route.ts) | 初期化 API |
| [app/api/onlive/poll/route.ts](../../app/api/onlive/poll/route.ts) | ポーリング API |
| [app/api/onlive/logs/route.ts](../../app/api/onlive/logs/route.ts) | ログ保存 API |
| [app/api/onlive/logs/[logId]/route.ts](../../app/api/onlive/logs/%5BlogId%5D/route.ts) | ログ取得・タイトル更新・削除 API |
| [app/api/onlive/logs/[logId]/favorite/route.ts](../../app/api/onlive/logs/%5BlogId%5D/favorite/route.ts) | ログお気に入りトグル API |
| [lib/showroom-realtime.ts](../../lib/showroom-realtime.ts) | WebSocket 定数・ユーティリティ |
| [lib/showroom/live.ts](../../lib/showroom/live.ts) | コメントログ・ライブ情報（`isPremiumLive` 含む）・テロップ取得 |
| [lib/showroom/gifts.ts](../../lib/showroom/gifts.ts) | ギフト定義・ギフトログ取得（プレミアムライブ時はフォールバックルームで取得） |
| [lib/showroom/onlives.ts](../../lib/showroom/onlives.ts) | オンライブ一覧取得・`getBcsvrKeyFromOnlives`（プレミアムライブ用 bcsvrKey 補完） |
| [lib/showroom/ranking.ts](../../lib/showroom/ranking.ts) | ライブ・総合ランキング取得 |
| [lib/showroom/room.ts](../../lib/showroom/room.ts) | ルームプロフィール取得 |
| [lib/onlive-log.ts](../../lib/onlive-log.ts) | ログ保存・取得・削除 |
| [lib/onlive-local-log.ts](../../lib/onlive-local-log.ts) | 非プレミアム用ローカルストレージログ読み書き |
| [lib/showroom-users.ts](../../lib/showroom-users.ts) | `DEVELOPER_USER_ID` 定数 |
| [lib/showroom-block-filter.ts](../../lib/showroom-block-filter.ts) | ブロックユーザーフィルタリング |
| [hooks/use-user-blocks.ts](../../hooks/use-user-blocks.ts) | ブロック一覧管理フック |
| [prisma/schema.prisma](../../prisma/schema.prisma) | `OnliveLog` / `UserBlock` モデル |
| [docs/screens/rescue.md](rescue.md) | ローカルストレージスナップショットの復旧画面仕様 |
