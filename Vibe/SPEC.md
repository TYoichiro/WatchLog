# SPEC.md — WatchLog 機能仕様書

> この文書は既存実装（Next.js 16 / React 19 / Prisma 7 / PostgreSQL）のコードを読み取って作成した、**同一挙動の別実装を作るための仕様書**。API 詳細は [API.md](./API.md)、DB は [DATA_MODEL.md](./DATA_MODEL.md)、環境変数は [ENV.md](./ENV.md)、インフラは [INFRA.md](./INFRA.md)、UI トーンは [DESIGN.md](./DESIGN.md)、テスト観点は [TEST_PLAN.md](./TEST_PLAN.md) を参照。

## 1. アプリケーション概要

WatchLog は **SHOWROOM（日本のライブ配信サービス）の配信ログ保存・閲覧ツール**。ターゲットは SHOWROOM の配信者本人（1 ユーザー＝1 ルーム登録）。招待コード制のクローズドサービスで、UI は全編日本語、時刻は全て JST。

主要ユースケース:
1. Google でログイン → 招待コードで自分のルームを登録
2. ダッシュボードでルームの状態（フォロワー・イベント・ファン）を確認。配信開始を WebSocket で検知して配信中画面へ自動遷移
3. 配信中画面でコメント・ギフト・ランキング・指標をリアルタイム閲覧。配信終了時にログを自動保存
4. 保存ログの一覧・詳細（振り返りサマリー付き）・JSON ダウンロード・一括 ZIP・インポート閲覧
5. 迷惑 SHOWROOM ユーザーのブロック（表示フィルタ）
6. プレミアム/管理者向け: ShowTube（配信視聴）、ログレスキュー
7. 管理者向け: ユーザー/ルーム/お知らせ/メンテナンス/BAN/セッション管理

バージョン表記: `package.json` の `version`（現在 `3.0.0-RC`）を `lib/version.ts` が `v3.0.0-RC` に整形し、全ヘッダー右端に表示。

## 2. ロールと権限

### 2.1 ロール（roles テーブル、seed 済み）
| ロール | 付与方法 | できること（差分） |
| --- | --- | --- |
| `user` | アカウント作成時に自動付与（NextAuth `createUser` イベント） | 基本機能。ログは localStorage 保存のみ（DB 保存不可）、タイトル編集・お気に入り・一括 DL 不可 |
| `premiumuser` | 管理者が付与、または **admin 発行の招待コードでルーム登録すると自動付与** | DB へのログ保存、タイトル編集、お気に入り、一括 DL、ShowTube、レスキュー |
| `admin` | **DB 直接操作でのみ付与**（API は 403 で拒否） | 全ユーザーのログ閲覧/削除/編集、管理画面一式、招待コード生成、ルーム重複登録の制約無視 |

### 2.2 権限（permissions、seed 済み）
`profile.read`（全ロール）/ `user.read` / `user.update` / `role.assign` / `audit.read`（admin のみ）。
管理 API は「admin ロール直接チェック（`requireTopAdminRole`）」と「権限チェック（`requirePermission`）」が混在する。対応は [API.md](./API.md) §8 の表の通り再現すること。

### 2.3 権限マトリクス（画面）
| 画面 | 未認証 | user | premiumuser | admin |
| --- | --- | --- | --- | --- |
| `/`（ログイン） | ○ | →/dashboard か /search | 同左 | 同左 |
| `/search` | →/ | ○（登録済なら→/dashboard） | 同左 | 同左 |
| `/dashboard` `/onlive` `/logs` `/block` `/settings` | →/ | ○ | ○ | ○ |
| `/logs/[logId]` | →/ | 自ルームのみ | 自ルームのみ | 全ログ |
| `/showtube` `/showtube/watch` `/rescue` | →/ | →/dashboard | ○ | ○ |
| `/admin/*` | →/ | →/dashboard | →/dashboard | ○ |
| `/maintenance` `/banned` | ○ | ○ | ○ | ○ |

### 2.4 BAN
- `users.is_banned=true` のユーザー: root layout が `/banned` へリダイレクト（`/banned` と `/api/*` 以外の全ページ）。`requireUser` を使う API は 403。
- BAN 契機: (a) 招待コード検証 3 回連続失敗（自動、actor=null）、(b) 管理者操作。いずれもセッション全削除を伴う。
- 解除時は `invite_code_failure_count` を 0 にリセット。

## 3. 全体アーキテクチャ・共通挙動

### 3.1 リクエストの流れ
1. **Proxy**（`proxy.ts`、Next.js 16 では middleware ではなく proxy）: 認証ゲート＋`x-watchlog-pathname` ヘッダー付与＋アクセス/API ログ。未認証は `/`・`/maintenance`・`/banned`・`/api/auth` 以外→`/` へリダイレクト。
2. **Root Layout**（Server Component）: `getActiveMaintenanceWindow()` があれば `/maintenance` 以外→`/maintenance` へ redirect。認証済みかつ BAN なら `/banned` へ redirect。`lang="ja"`、Geist Sans、TooltipProvider、Vercel SpeedInsights/Analytics。metadata: title "WatchLog"、description "SHOWROOMの配信ログを保存できるツールです"、keywords（ショールーム, SHOWROOM, 配信, コメント, ウォッチログ, watchlog, 配信ログ, コメントビューアー, コメビュ）。
3. 各ページ/API。

### 3.2 エラーバウンダリ
`app/error.tsx` と `app/onlive/error.tsx`（同一実装）: 閉じられないダイアログ「エラーが発生しました / 再読み込みを行います。」→ OK で `window.location.reload()`。`loading.tsx` / `not-found.tsx` は存在しない（ログ詳細の `notFound()` は Next.js 既定 404）。

### 3.3 AppShell（共通レイアウト、`components/navigation/app-sidebar.tsx`）
- ヘッダー（h-16、sticky）: メニュー開閉ボタン（`showMenu=false` の画面では非表示）＋タイトル「WatchLog」（`/onlive` ではリンク無効、他は /dashboard へのリンク）＋右端に `APP_VERSION`。`headerActions` スロット（オンライブ: 設定モーダル、ログ詳細: サマリーボタン）。
- サイドバー（xl 以上は常設 w-72・トグルで消せる。xl 未満はオーバーレイドロワー）:
  - 共通: ホーム(/dashboard)・ログ閲覧(/logs)・ブロック(/block)・設定(/settings)
  - premium または admin: 「プレミア機能」区切り＋ShowTube(/showtube)
  - admin: 「管理者」区切り＋ユーザー一覧・ルーム一覧・メンテナンス・お知らせ
  - フッター: 「Create by よーいちろー」（https://x.com/yoichiro_sub）＋ログアウトボタン（`signOut({redirectTo:"/"})`、実行中は「ログアウト中...」）
- activeKey は pathname から自動判定も可能（プレフィックスマッチ）。

### 3.4 localStorage キー一覧（クライアント永続化）
| キー | 内容 |
| --- | --- |
| `watchlog:onlive:<roomId>` | 配信中スナップショット v1 `{version:1, roomId(number), liveId, savedAt(ms), comments[], gifts[], metrics}`。配信中に随時マージ保存、配信外/保存完了時に削除 |
| `watchlog:saved-log:<roomId>` | 非プレミアムの配信終了ログ（直近 1 件のみ） `OnliveLocalLog` |
| `watchlog:json-viewer` | JSON インポート閲覧用の一時データ |
| `watchlog_dashboard` | ダッシュボード表示キャッシュ（TTL 24h、profile/activeFan/notices/noticesHasError＋cachedAt） |

## 4. 画面仕様

### 4.1 画面一覧と遷移

| URL | 画面 | レンダリング | 認証 | 実装 |
| --- | --- | --- | --- | --- |
| `/` | ログイン | Server | 不要 | `app/page.tsx` + `components/login/login-screen.tsx` |
| `/search` | ルーム検索・登録 | Client | 必要 | `app/search/page.tsx` |
| `/dashboard` | ダッシュボード | Client | 必要 | `app/dashboard/page.tsx` |
| `/onlive` | 配信中 | Client | 必要 | `app/onlive/page.tsx` + `components/onlive/onlive-room-page.tsx` |
| `/logs` | ログ一覧 | Server+Client | 必要 | `app/logs/page.tsx` + `components/logs/log-list-page.tsx` |
| `/logs/[logId]` | DB ログ詳細 | Server+Client | 必要 | `OnliveLogViewerPage` |
| `/logs/local/[roomId]` | ローカルログ詳細 | Server+Client | 必要 | `components/logs/local-log-viewer-page.tsx` |
| `/logs/json-import` | JSON インポート閲覧 | Server+Client | 必要 | `components/logs/json-import-viewer-page.tsx` |
| `/block` | ブロック一覧 | Server+Client | 必要 | `components/block/block-list-page.tsx` |
| `/settings` | 設定 | Server | 必要 | `app/settings/page.tsx` |
| `/showtube` | 配信中一覧 | Server | premium/admin | `app/showtube/page.tsx` |
| `/showtube/watch?room_id=` | HLS 視聴 | Server+Client | premium/admin | `components/showtube/showtube-watch-page.tsx` |
| `/rescue` | ログレスキュー | Server+Client(ssr:false) | premium/admin | `components/rescue/rescue-page.tsx` |
| `/admin/users` | ユーザー管理 | Server+Client | admin | `components/admin/user-list-page.tsx` |
| `/admin/rooms` | ルーム管理 | Server+Client | admin | `components/admin/room-list-page.tsx` |
| `/admin/notices` | お知らせ管理 | Server+Client | admin | `components/admin/notices-page.tsx` |
| `/admin/maintenance` | メンテナンス管理 | Server+Client | admin | `components/admin/maintenance-page.tsx` |
| `/maintenance` | メンテナンス中 | Server | 不要 | `app/maintenance/page.tsx` |
| `/banned` | BAN 画面 | Server | 不要 | 白背景 div のみ |

遷移図（主要フロー）:
```
/ ──Google OAuth──> (登録ルームなし) /search ──招待コード検証→検索→登録──> /dashboard
                    (登録ルームあり) /dashboard ──配信開始検知(WS t=104) or is_live──> /onlive
/onlive ──配信終了(WS t=101)→ログ自動保存→ダイアログ──> /dashboard
/logs ──閲覧──> /logs/[logId] | /logs/local/[roomId] | (JSON選択)→/logs/json-import
全画面 ──メンテ有効──> /maintenance、──BAN──> /banned
```

### 4.2 ログイン `/`
- セッションあり: BAN→/banned、登録ルームあり→/dashboard、なし→/search（サーバー redirect）
- 白カード中央に「WatchLog」＋「Googleでログイン」ボタン（Server Action で `signIn("google", {redirectTo: "/"})`）
- 下に LOGIN/ALL 対象のお知らせカード（`NoticeListCard`）。取得失敗時は「取得失敗」バッジ＋エラーカード（500 にしない）

### 4.3 ルーム検索・登録 `/search`
- マウント時に `/api/registered-room` を確認、登録済なら `/dashboard` へ replace。確認完了まで `null` を描画
- AppShell（`showMenu=false`、activeKey="search"）
- **招待コードモーダル**（検証成功まで常時表示、閉じられない）:
  - 入力は自動大文字化・maxLength 10。形式 `[A-Z0-9]{10}` 以外は「招待コードの形式が正しくありません。」（API を呼ばない）
  - `/api/invitations/verify` → valid: モーダル閉じて検索可能に / banned: 「招待コードの入力に3回失敗したため、アカウントがBANされました。」→ `/banned` へ push / invalid: 「招待コードが正しくありません。残りN回入力できます。」/ 通信エラー: 「招待コードを確認できませんでした。時間をおいて再試行してください。」
  - 補助文言: 「ルーム登録には招待コードが必要です。」「10桁の英数字を入力してください。」
- 検索フォーム: プレースホルダー「ルーム名を検索」。空検索→「検索キーワードを入力してください。」。`/api/room/search` 失敗→「検索結果を取得できませんでした。…」。結果ヘッダー「検索結果」「{keyword} / {N}件」。未検索:「ルーム名を検索してください。」0 件:「該当するルームが見つかりませんでした。」
- 結果カード（画像 16:9・ルーム名・#roomId・roomUrl）クリック→**登録確認モーダル**「登録しますか？」＋ルーム ID/URL 表示＋警告「ルームは配信者本人しか登録できません。他人が登録をすると配信者本人が使えなくなるので注意してください。」
- 「はい」→ `/api/registered-room/check` で重複確認 → 重複なら**エラーモーダル**「登録できません」＋「既に登録されているため登録できません」＋「配信者本人ですが、他人に取られている場合は こちら(https://x.com/yoichiro_sub)」
- 非重複なら `PUT /api/registered-room`。成功→ `/dashboard` replace。エラーメッセージに「招待コード」を含む場合は招待コードモーダルへ差し戻し（verifiedInviteCode をクリア）

### 4.4 ダッシュボード `/dashboard`
- Client Component。マウント時:
  1. localStorage キャッシュ（TTL 24h）があれば即時表示（スケルトン回避）
  2. レスキュー可能スナップショット（`watchlog:onlive:` プレフィックス、version 1、liveId 非空）の有無をスキャン
  3. `GET /api/dashboard` → `no_room`→/search、`is_live`→/onlive、`ok`→表示＋キャッシュ保存
- 表示: HeroCard（ルーム画像＋「公式枠ルーム/フリー枠ルーム」バッジ＋ルーム名。取得失敗時「ルーム情報を取得できませんでした」）→（premium/admin かつレスキュー可能ログあり）amber バナー「未保存の復旧可能ログがあります → 復旧はこちら(/rescue)」→ RoomStatsSection（6 カード: フォロワー数 / アクティブファン（fan_name をタイトルに）/ ルームレベル / 次回配信予定（`formatTime`: 「YYYY年MM月DD日（曜） HH時MM分」、null は「未定」）/ SHOWランク（`show_rank_subdivided`＋時給表 [DESIGN.md](./DESIGN.md) §4）/ ジャンル。取得失敗は「取得できませんでした」）→ EventOverviewCard（イベントなし＆サポートなしなら非表示。順位・ポイント・gap 表示「2位との差 N pt」or「次順位まで N pt」）→ NoticeListCard
- **配信開始監視**: `roomStatus.broadcastKey` があり **admin でない**場合、`wss://online.showroom-live.com/` に接続し `SUB\t<broadcastKey>`、60 秒 PING。`t=104` 受信→ `/onlive` へ replace。エラー/切断→ `window.location.reload()`（意図的クローズ時を除く）

### 4.5 配信中 `/onlive`（最重要画面）
初期化: `GET /api/onlive/init`。エラー/`no_room`→/search。取得まで null 描画。

**上段メトリクスカード 4 枚**:
- 獲得ポイント「約N pt」＋内訳（有料/無料）。ポイントはギフトログから集計（`summarizeGiftTotals`）。ギフト 0 件時は localStorage スナップショットの metrics をフォールバック
- フォロワー数＋「配信開始から ±N人」バッジ（初回ポーリング値 or スナップショット initialFollowerNum と比較）
- 盛り上がり（view_num）＋「1分前比 ±N」バッジ（前回ポーリング値と比較）
- 配信開始時間「HH時MM分SS秒」＋日付＋経過時間（1 秒ごと更新。配信終了後は endedAt で固定）

**下段**: 左=コメントパネル（テロップバー amber 背景「テロップ：…」＋コメントテーブル）、右=2×2（無料ギフト / 有料ギフト / ライブランキング / 累計ランキング）。

**リアルタイム（WebSocket）**: liveInfo.bcsvrKey で接続。
- t=1 コメント / t=18・t=1001 お知らせ（noticeTone: follow/fanLevel/fanCount/visit/firstVisit/ranking。本文の正規表現からユーザー名抽出、行背景色を色分け）/ t=2 ギフト（ギフト定義 Map から名前・ポイント補完、giftType=2 は有料）/ t=101 配信終了（「YYYY年MM月DD日HH時MM分SS秒に配信が終了しました」お知らせ行を先頭に追加）/ telop 更新
- コメント/ギフトは ID と内容キー（`` 区切り）で重複排除。ギフトは同一 user×gift が 30 秒以内なら count 加算マージ
- WS エラー/切断→「エラーが発生しました/再読み込みを行います。」ダイアログ→reload

**ポーリング**: 60 秒ごと `GET /api/onlive/poll`（プレミアムライブ時は `skip_ranking=1`）。profile・ライブ/累計ランキング更新。配信終了後は停止。

**localStorage スナップショット**: 配信中（liveStatus≠1 かつ未終了）は comments/gifts/metrics を `watchlog:onlive:<roomId>` へ随時マージ保存（liveId が変わったら破棄）。liveStatus=1（配信外）で削除。

**配信終了時の自動保存**（t=101 受信後、1 回だけ）:
- capturedAt = 終了時刻の JST ISO。ログペイロード構造:
```json
{"capturedAt","comments":[CommentRow...],"gifts":[RoomGiftLog...],
 "liveInfo":{"endedAt","liveId","liveStatus","startedAt","telop"},
 "localStorageSnapshot":snapshot|null,"metrics":{giftTotals,initialFollowerNum,latestFollowerNum,latestAudienceNum,previousAudienceNum},
 "rankings":{"live":[...]},"roomProfile":RoomProfile|null,"roomId":number,
 "savedAt","source":"onlive-end","version":1}
```
- premium: `POST /api/onlive/logs`（サーバーが rankings.total と server.savedAt を追記）。成功→スナップショット削除→「配信は終了しました、ダッシュボードに戻ります」ダイアログ→/dashboard
- 非 premium: `watchlog:saved-log:<roomId>` へ保存（上書き＝直近 1 件のみ）→同ダイアログ
- 保存失敗時はダイアログを出さない（console.error のみ。スナップショットが残るためレスキュー可能）

**各種ダイアログ**: プレミアムライブで bcsvrKey 取得不可→「プレミアムライブ/この配信はプレミアムライブです\n接続まで暫くお待ちください」→OK で /dashboard。liveStatus=1 または初回 profile.isOnlive=false→「配信中ではありません」→OK で /dashboard。

**ユーザープロフィールモーダル**（コメント・ギフト・ランキングのアバター/行クリック）: `/api/room/user-profile` を取得しキャッシュ。ユーザー/ルームのタブ切替（ルームプロフィールがある場合）。ファンレベル・リスナーレベル・クラスレベル、SNS リンク、SMS 認証済み/未認証バッジ、ブロックボタン（開発者 ID `3699368` は「開発者はブロックできません」で無効。ブロック済みは「ブロック済み」）。開発者には「私がWatchLogの開発者」バッジと専用訪問バッジ（violet）。訪問ステータスバッジ: ua=2「初見」(sky)、ua=1「ビギナー」(emerald)。
**ヘッダー設定モーダル**: 「お知らせ系通知」スイッチ（OFF でコメント欄から notice 行を非表示）。

### 4.6 ログ一覧 `/logs`
- サーバー側分岐: admin→`listAllOnliveLogs`（全ルーム、capturedAt desc、**500 件**）、premium→`listUserOnliveLogs`（自ルーム、**100 件**）、非 premium→空配列を渡し、クライアントで `watchlog:saved-log:<roomId>` の 1 件を表示
- ヘッダー「ログ一覧 N件」＋（premium/admin かつ 1 件以上）「一括ダウンロード」ボタン＋表示件数セレクト（20/50/100、既定 20）
- JSON インポートカード: 「JSONログ閲覧 / ダウンロードしたJSONファイルを選択してログを閲覧できます（旧バージョン（v2.X.X系）の互換性はありません）」。ファイル選択→ビューア形式 or レスキュースナップショット形式を判定して `watchlog:json-viewer` に保存→`/logs/json-import` へ。不正なら「正しい形式のWatchLog JSONファイルではありません。」/「JSONファイルの読み込みに失敗しました。」
- 各行: ♥お気に入り（premium/admin のみ。楽観更新、失敗時ロールバック）、タイトル（未設定時は capturedAt の日本語表記。鉛筆アイコンでインライン編集、Enter=確定 blur、Esc=取消、空=解除）、`Live ID: N` バッジ、コメント数・ギフト数チップ、「閲覧」「ダウンロード」「削除」
- ダウンロード: DB ログは `GET /api/onlive/logs/[id]` の JSON を `watchlog-{liveId}-{YYYYMMDD}.json` で保存。ローカルログは localStorage から直接
- 削除: 確認ダイアログ「ログを削除しますか？/{タイトル} のログを削除します。」。非 premium はローカル削除のみ
- 空状態: 「保存済みログはまだありません。配信終了時にログが保存されます。」
- ページング: 7 ページ以下は全表示、超えると 1 … (current±1) … last

### 4.7 ログ詳細 `/logs/[logId]`・`/logs/local/[roomId]`・`/logs/json-import`
共通ビューア `OnliveLogViewerPage`（オンライブ画面と同じレイアウトのスナップショット版、`isSnapshot=true`）:
- メトリクス 4 カード（ログの metrics/roomProfile から復元。フォロワーバッジは「開始から」）
- コメント/ギフト/ランキングは log JSON＋localStorageSnapshot をマージ・重複排除して表示。ブロック中ユーザーはフィルタ
- テロップなし時: 「テロップは保存されていません」
- ヘッダーに **配信サマリー**ボタン（`LiveSummaryDialog`）: 獲得ポイント（有料/無料）、フォロワー増減、新規フォロー数、初見数、コメント数/人数、ギフト数/人数、配信時間、トップギフター/トップコメンター（上位 5 名）。**前回配信ログ**（同ルームで capturedAt が直前の未削除ログ）があれば差分（±）バッジ付き比較
- DB 版はサーバーで所有権チェック（admin=全ログ、一般=自ルーム）。なければ `notFound()`
- ローカル版/インポート版は localStorage から読む（`useSyncExternalStore` / 初期 state）。なければ「ローカルのログが見つかりませんでした。」/「JSONログが見つかりませんでした。ログ一覧からJSONファイルを選択してください。」

### 4.8 ブロック `/block`
- テーブル: ID / ユーザー名（クリックでプロフィールモーダル）/ ブロック日時（秒まで）/ 削除ボタン
- 削除は確認ダイアログ「削除しますか？/{名前} のブロックを解除します。」
- ヘッダー「ブロックユーザー N件」。取得失敗「ブロック一覧を取得できませんでした。」空「ブロック中のユーザーはいません。」
- プロフィールモーダルからの再ブロックも可能（ブロック済み表示）

### 4.9 設定 `/settings`
- RoleCard: 「あなたは{管理者|プレミアム|一般}ユーザーです」
- InvitationCodeCard: 見出しは一般「招待コード（最大3名まで招待することができます）」、admin「招待コード（現在N名招待できるコードがあります　未利用：N件　使用済み：N件）」。コード一覧（等幅フォント）＋「有効/無効」バッジ。admin のみ「招待コード生成」ボタン（`POST /api/invitations` → router.refresh）
- 登録ルームがなければ /search へ redirect

### 4.10 ShowTube `/showtube`・`/showtube/watch`
- 専用シェル `ShowTubeShell`（サイドバー: 戻る(/dashboard)・ShowTube(全ジャンル)・ジャンル一覧。ヘッダー: ShowTube リンク＋APP_VERSION）
- 一覧: `getOnlives()` をサーバーで取得。`?genre=` でジャンル絞り込み。roomId で重複排除。カード（サムネ・名前・#roomId）→ `/showtube/watch?room_id=`。エラー「データの取得に失敗しました。」空「ライブ中のルームはありません。」
- 視聴: `getHlsStreamingUrls`（quality 0 を既定選択）＋hls.js（未対応ブラウザは native HLS）。画質ボタン切替。コメントは初期値=comment_log、以降 WebSocket（t=1 のみ、最大 300 件保持、自動スクロール・手動スクロールで停止）。WS 状態バッジ（接続中/接続中.../切断）。onlives に該当ルームがなければ「配信が見つかりません」＋一覧へ戻る。room_id 不正→/showtube へ redirect
- PC はコメントパネル高さを動画高さに ResizeObserver で同期。モバイルは h-72 固定

### 4.11 ログレスキュー `/rescue`
- `ssr:false` の dynamic import（localStorage 走査のため）
- `watchlog:onlive:*` の有効スナップショット（version 1、liveId 非空、comments/gifts 配列、savedAt 数値）を列挙: ルームID/ライブID/コメント数/ギフト数/最終更新
- 「復旧する」= 各エントリを順次 `POST /api/onlive/logs`（log.source="rescue"、liveInfo は endedAt/startedAt null、rankings.live=[]、roomProfile=null。capturedAt はスナップショット savedAt）→成功で localStorage から削除・「保存しました」。失敗は「エラー: {message}」（**非プレミアムは 403 Forbidden になる**）
- 「ダウンロード」= 生 JSON を `watchlog-rescue-{roomId}-{liveId}.json` で保存。「削除」= エントリ破棄
- 0 件: 「ローカルストレージにログが見つかりませんでした」

### 4.12 管理画面
- `/admin/users`: 全ユーザー行（アバター/名前/自分・管理者・BAN バッジ/メール/登録ルーム or 未登録/作成日時）。BAN セレクト（許可/BAN。admin 行は「管理者」固定、自分は「操作不可」）。「N件のBANユーザーがいます」警告
- `/admin/rooms`: 全登録ルーム＋所有ユーザー。ロールセレクト（一般ユーザー/プレミアムユーザー→`PATCH /api/admin/users/[id]/role`）
- `/admin/notices`: CRUD。フォーム（タイトル/内容/表示対象 AUTHENTICATED=ログイン後・LOGIN=ログイン画面・ALL=全員/公開日時/失効日時/リンクURL）。状態バッジ: 公開中/公開予定/期限切れ
- `/admin/maintenance`: CRUD。フォーム（タイトル既定「システムメンテナンス」/メッセージ/開始/終了/有効スイッチ）。状態バッジ: アクティブ/予定/終了済み/無効
- いずれも Server Component が初期データを Prisma 直読みし、Client がフェッチで CRUD

### 4.13 メンテナンス `/maintenance`・BAN `/banned`
- メンテナンス: アクティブウィンドウがなければ `/` へ redirect。タイトル・「{開始}〜{終了} までメンテナンス中です。」（`YYYY/MM/DD(曜) HH:mm` 形式）・メッセージ（未設定時は既定文言）。admin には「メンテナンスを停止」ボタン（`PATCH /api/admin/maintenance/[id]` isEnabled=false → `/`）
- `/banned`: 白背景のみ（`<div className="min-h-screen bg-white" />`）

## 5. 認証・セッション仕様

- NextAuth v5 beta、Google プロバイダのみ、PrismaAdapter、**database セッション**（maxAge 180 日 = 15,552,000 秒）、`trustHost: true`
- セッションに `user.id` を注入（`types/next-auth.d.ts` で型拡張）
- ユーザー作成時: `user` ロール upsert 付与＋監査ログ。サインイン/アウトも監査ログ
- サインアウトは クライアントから `next-auth/react` の `signOut({redirectTo: "/"})`

## 6. ブロック機能仕様

- ブロック対象は **SHOWROOM ユーザー ID**（アプリ内ユーザーではない）
- 適用箇所: オンライブのコメント/ギフト/ランキング、ログ詳細の表示・サマリー集計、`/api/room/comments|gifts|live-ranking|total-ranking`、`/api/onlive/init|logs`（保存時の total ranking にも適用）
- `userId=null`（ゲスト）はフィルタ対象外。フィルタは `filterBlockedShowroomItems`（Set 照合）
- サーバー側はユーザーごとの blocked ID 一覧を 60 秒キャッシュ（tag 無効化付き）
- 開発者ユーザー `3699368` はブロック不可（API 403／UI ボタン無効）

## 7. 配信ログデータ仕様

### 7.1 ビューア互換 JSON（ダウンロード/インポート形式）
```json
{"capturedAt": "JST ISO", "liveId": "...", "roomId": "...", "log": { ...OnliveLogPayload }}
```
### 7.2 レスキュースナップショット形式（インポート対応）
`{version:1, roomId:number, liveId:string, savedAt:number(ms), comments:[], gifts:[], metrics}` → インポート時にビューア形式へ変換（source:"rescue"）。
### 7.3 サーバー追記
POST 時に `log.rankings.total` / `totalFetchedAt` / `totalFetchError`、`log.server={savedAt, version:1}` を追記。
### 7.4 log 内の主要フィールド
§4.5 の OnliveLogPayload を参照。CommentRow は RoomComment＋`{notice, noticeTone, telop, timeLabel, titleLabel, userVisitStatus}`。

## 7.5 API 仕様（一覧表）

詳細（リクエスト/レスポンス例・エラーコード・認可）は [API.md](./API.md)。エラー形式は `{"error": "..."}`、コードは 400/401/403/404/409/422/500/502。

| Method | パス | 認可 | 概要 |
| --- | --- | --- | --- |
| GET/POST | `/api/auth/[...nextauth]` | — | NextAuth（Google OAuth） |
| GET | `/api/dashboard` | 認証 | ダッシュボード統合情報（no_room/is_live/ok） |
| GET | `/api/dashboard/notices` | 認証 | ログイン後お知らせ一覧 |
| GET / PUT | `/api/registered-room` | 認証 | 登録ルーム取得 / 招待コード消費して登録 |
| GET | `/api/registered-room/check` | 認証 | 他ユーザー重複確認 |
| POST | `/api/invitations` | admin | 招待コード生成 |
| POST | `/api/invitations/verify` | 認証 | 招待コード検証（3 回失敗で自動 BAN） |
| GET | `/api/room/search` | proxy 前提 | ルーム検索（HTML スクレイピング） |
| GET | `/api/room/profile` `/status` `/comments` `/gifts` `/paid-gifts` `/gift-definitions` `/telop` `/live-ranking` `/total-ranking` `/activefan` `/eventandsupport` `/user-profile` | proxy 前提（一部ブロックフィルタ） | SHOWROOM プロキシ 12 本 |
| GET | `/api/live/liveinfo` | proxy 前提 | ライブ情報（プレミアムライブ判定） |
| GET | `/api/onlive/init` | 認証 | オンライブ初期化データ |
| GET | `/api/onlive/poll` | 認証 | 60 秒ポーリング（profile/ランキング） |
| POST | `/api/onlive/logs` | premium | 配信ログ保存（total ranking 追記） |
| GET/PATCH/DELETE | `/api/onlive/logs/[logId]` | 認証（PATCH は premium/admin） | ログ取得 / タイトル / 論理削除 |
| PUT | `/api/onlive/logs/[logId]/favorite` | premium/admin | お気に入りトグル |
| GET | `/api/onlive/logs/bulk-download` | premium/admin | 全ログ ZIP |
| GET/POST | `/api/blocks`、DELETE `/api/blocks/[blockId]` | 認証 | ブロック CRUD |
| GET | `/api/admin/users` | user.read | ユーザー一覧 |
| PATCH | `/api/admin/users/[userId]/role` | role.assign | premium 付与/剥奪 |
| POST | `/api/admin/users/[userId]/roles` | role.assign | 任意ロール付与（admin 不可） |
| PATCH | `/api/admin/users/[userId]/ban` | admin | BAN/解除 |
| GET | `/api/admin/audit-logs` | audit.read | 監査ログ（limit 1-100） |
| POST | `/api/admin/sessions/cleanup` | admin | 期限切れセッション削除 |
| GET/POST、PATCH/DELETE `[id]` | `/api/admin/maintenance` | admin | メンテナンス CRUD |
| GET/POST、PATCH/DELETE `[id]` | `/api/admin/notices` | admin | お知らせ CRUD |

## 7.6 データモデル仕様（テーブル一覧）

定義・制約・リレーションの詳細は [DATA_MODEL.md](./DATA_MODEL.md)。全 16 テーブル:

| テーブル | 役割 |
| --- | --- |
| `users` | アプリユーザー（is_banned / invite_code_failure_count 含む） |
| `accounts` / `sessions` / `verification_tokens` | NextAuth 標準（DB セッション） |
| `roles` / `permissions` / `user_roles` / `role_permissions` | ロール・権限（admin/user/premiumuser × 5 権限） |
| `user_registered_rooms` | ユーザー 1:1 の登録 SHOWROOM ルーム |
| `invitation_codes` | 招待コード（10 桁英数、消費で is_deleted=true） |
| `user_blocks` | SHOWROOM ユーザーのブロック |
| `dashboard_notices` | お知らせ（AUTHENTICATED/LOGIN/ALL） |
| `maintenance_windows` | メンテナンス期間 |
| `onlive_logs` | 配信ログ本体（JSONB＋counts、論理削除） |
| `onlive_log_favorites` | ログお気に入り |
| `audit_logs` | 監査ログ |

## 8. 外部連携仕様

| 連携先 | 用途 | 備考 |
| --- | --- | --- |
| SHOWROOM REST/HTML | ルーム・ライブ情報のサーバープロキシ | [API.md](./API.md) §9。UA 偽装ヘッダー必須 |
| SHOWROOM WebSocket | リアルタイムコメント/ギフト/配信開始・終了 | ブラウザ直結。[API.md](./API.md) §10 |
| SHOWROOM CDN | 画像・HLS | ブラウザ直結 |
| Google OAuth | ログイン | リダイレクト URI 登録必要 |
| Vercel Analytics / Speed Insights | 計測 | layout に `<Analytics/>` `<SpeedInsights/>` |
| Axiom (next-axiom) | ログ転送 | `NEXT_PUBLIC_AXIOM_TOKEN` 設定時のみ有効。`withAxiom(nextConfig)`＋`log.middleware(request)` |

## 9. 非機能要件

### 9.1 ログ
- `lib/logger.ts`: レベル debug/info/warn/error。最小レベルは `LOG_LEVEL`（既定: 本番 info、他 debug）
- 出力先: (1) `logs/YYYY-MM-DD.log`（JST 日付、JSON Lines、`{time(JST ISO), level, msg, ...context}`。VERCEL または LOG_FLG=skip で無効、書込エラーは黙殺）(2) コンソール（本番=JSON、開発=`{time} [LEVEL] msg | {context}`）(3) Axiom（任意）
- proxy が API リクエスト（method/path/userId/ip/ua）を info 記録（`/api/onlive/poll` 除外）

### 9.2 監査ログ（audit_logs）
書き込みは `writeAuditLog`（トランザクション対応）。action 一覧: `auth.user.create` / `auth.sign_in` / `auth.sign_out` / `room.register` / `role.assign` / `role.remove` / `user.ban` / `user.unban` / `dashboard_notice.create|update|delete` / `maintenance_window.create|update|delete` / `session.cleanup_expired` / `onlive_log.delete`。

### 9.3 キャッシュ戦略
- 全 API ルート `force-dynamic`、クライアント fetch は `cache: "no-store"`
- 唯一のサーバーキャッシュ: ブロック ID 一覧の `unstable_cache`（60 秒＋tag 無効化）
- クライアント: ダッシュボード localStorage キャッシュ（24h）

### 9.4 セキュリティ
- 入力検証は各ルート冒頭で手書き（zod 不使用）。文字列 trim・型ガード
- お知らせ linkUrl は表示時に http/https のみ許可
- CSP/CORS/レート制限の実装はなし（`allowedDevOrigins: ["127.0.0.1"]` のみ）
- admin ロールの API 付与禁止、自己 BAN・admin BAN 禁止
- 招待コード総当たり対策: 3 回失敗で自動 BAN

### 9.5 パフォーマンス
- SHOWROOM 呼び出しは `Promise.allSettled` で並列化し、部分失敗を UI にエラーフラグとして伝搬（全体 500 にしない）
- オンライブポーリング 60 秒、WS PING 60 秒、経過時間タイマー 1 秒
- ログ一覧の取得上限（admin 500 / 一般 100）

### 9.6 多言語
なし（日本語ハードコード）。`<html lang="ja">`。

## 10. 既知の制約・元実装特有の癖（仕様として維持）

1. **JST 壁時計を UTC フィールドに持つ Date** で全比較・保存を行う（`lib/jst.ts`）。`new Date().toLocaleString()` 等の暗黙 TZ 依存は禁止
2. Prisma Client は `app/generated/prisma` に生成（gitignore 済み。`postinstall: prisma generate`）
3. `middleware.ts` ではなく **`proxy.ts`**（Next.js 16 のリネーム）
4. 画像は `next/image` を使わず `<img>`（eslint-disable コメント付き）
5. プレミアムライブ: bcsvrKey は onlives 一覧から補完、ランキング取得不可（skip_ranking）、gift_groups はフォールバックルーム 317313、liveId 欠落時は JST `YYYYMMDD`
6. ギフトは user×gift 30 秒窓でマージ。無料ギフト allowlist（星・種・カウント 10001〜10025 等）はコード内定数。point=0 の無料ギフトは 1pt/個 として集計
7. 非 premium のログはブラウザ localStorage のみ（機種変更・別ブラウザで消える）。API 側も premium 以外の保存を 403 で拒否
8. `room_id` の一意性は DB 制約でなくアプリロジック（admin はバイパス可）
9. favorite API は所有権 NG でも 200（[API.md](./API.md) §6）
10. openapi.yaml（docs/）には bulk-download 未記載。README の「Next.js 16.2.4」表記は package.json（16.2.9）と不一致 — **実装を正とする**
11. `docs/` の CLAUDE.md 系記述「route handler テストで Prisma をモックしない」は実態と相違: **実テストは `vi.mock("@/lib/prisma")` でモックしている**（[TEST_PLAN.md](./TEST_PLAN.md)）
12. admin はダッシュボードの配信開始 WebSocket 監視を行わない（自分の配信を持たない想定）
13. 招待コードは消費時に `is_deleted=true`（論理削除フラグを「使用済み」の意味でも使う）
14. 一括ダウンロードのフォールバックファイル名が `watchlog-bulk.json`（ZIP なのに .json）になる分岐がクライアントにある（Content-Disposition が取れない場合）— 実装通りでよい

## 11. `docs/` との相違点一覧

| 箇所 | docs/ の記載 | 実装（正） |
| --- | --- | --- |
| `docs/openapi.yaml` | `/onlive/logs/bulk-download` なし | GET で存在（ZIP 返却） |
| `README.md` 技術スタック | Next.js 16.2.4 | package.json は `next@16.2.9` |
| ルート `CLAUDE.md` テスト規約 | 「route handler の単体テストで Prisma をモックしない」 | 実テストは prisma/auth/logger を `vi.mock` している |
| `docs/screens/*.md` | 16 画面の設計書 | 主要記述は実装と一致することを確認（onlive/logs/ダッシュボード等）。細部は本 SPEC を正とする |
