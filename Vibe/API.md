# API.md — API エンドポイント詳細リファレンス

> 出典: `app/api/**/route.ts` 全 30 ファイルの実装。`docs/openapi.yaml` と突き合わせ済み（相違点: **`GET /api/onlive/logs/bulk-download` が openapi.yaml に未記載**。実装を正とする）。
> すべての Route Handler は `export const dynamic = "force-dynamic"`（`/api/auth/[...nextauth]` を除く）。
> 認証は NextAuth の **DB セッション Cookie**。タイムスタンプはすべて JST の ISO 8601 文字列（`+09:00`）。

## 0. 共通事項

### 0.1 Proxy（ミドルウェア）による前段ガード

`proxy.ts`（Next.js 16 の Proxy。旧 Middleware）が matcher `/((?!api/auth|_next/static|_next/image|favicon.ico|.*\.(png|jpg|jpeg|gif|webp|svg|ico)$).*)` で全ルートに適用され:

1. `x-watchlog-pathname` ヘッダーに pathname を設定（root layout がメンテナンス/BAN 判定に使用）
2. `/api/*`（`/api/onlive/poll` を除く）へのリクエストを `logger.info("APIリクエスト", {method, path, userId, ip, ua})` で記録。非 API パスは Vercel 以外で `アクセス` ログ
3. **未認証**かつ pathname が `/`・`/maintenance`・`/banned` 以外なら **`/` へ 307 リダイレクト**（API も対象。ただし各ルートは自前でも 401 を返す）

### 0.2 認可ヘルパー（lib/authz.ts）

| 関数 | 挙動 |
| --- | --- |
| `requireUser()` | セッションなし→`UnauthorizedError`(401)。**DB で `isBanned` を確認し、BAN 済みは `ForbiddenError`(403 "Banned")** |
| `requireTopAdminRole()` | requireUser → `admin` ロール必須 |
| `requirePermission(action)` | requireUser → Role→RolePermission→Permission を辿って action 保有を確認 |
| `authzErrorResponse(e)` | 401 `{"error":"Unauthorized"}` / 403 `{"error":"Forbidden"}` に変換。該当しなければ null |
| `getUserRoles(userId)` | `{isAdmin, isPremium}` を返す |

注意: `auth()` を直接使って `session?.user?.id` だけを見るルート（dashboard, registered-room, invitations/verify, onlive/init, onlive/poll, onlive/logs POST, live/liveinfo）は **BAN チェックを行わない**（BAN 時はセッション自体が削除される＋レイアウトでリダイレクトされる設計）。

### 0.3 エラーレスポンス形式

`{ "error": "<メッセージ>" }`。バリデーションエラー 400、未認証 401、権限/BAN 403、404、409（ルーム重複）、422（無効招待コード）、500、SHOWROOM 上流エラー 502。

---

## 1. 認証

### GET/POST `/api/auth/[...nextauth]`
NextAuth v5 ハンドラー（`auth.ts` の `handlers` を re-export）。Google OAuth のみ。セッション: DB 戦略・maxAge 180 日。`trustHost: true`。
- events: `createUser`（`user` ロール付与＋監査ログ `auth.user.create` をトランザクションで実行）/ `signIn`（`auth.sign_in`）/ `signOut`（`auth.sign_out`）
- callbacks.session: `session.user.id = user.id` を注入

## 2. ダッシュボード

### GET `/api/dashboard` — 認証必須（auth() 直接）
未認証→401。登録ルームなし→`{"status":"no_room"}`。
SHOWROOM 4 API＋お知らせを `Promise.allSettled` で並列取得（失敗は null/[] で握りつぶし）。
レスポンス:
```json
{
  "status": "is_live" | "ok",     // profile.isOnlive または roomStatus.isLive が true なら is_live
  "isAdmin": bool, "isPremium": bool,
  "registeredRoom": {"roomId": "...", "roomUrl": "..."},
  "profile": RoomProfile|null, "activeFan": ActiveFanSummary|null,
  "eventAndSupport": EventAndSupportSummary|null,
  "notices": AppNotice[], "noticesHasError": bool,
  "roomStatus": RoomStatus|null
}
```

### GET `/api/dashboard/notices` — 認証必須
`{"notices": AppNotice[]}`（AUTHENTICATED/ALL 対象、公開中かつ未失効、publishedAt desc）。AppNotice = `{id, title, date("YYYY/MM/DD HH:mm" 形式の日本語表記), body, linkUrl(http/https のみ、それ以外 null)}`。

## 3. 登録ルーム

### GET `/api/registered-room` — 認証必須
`{"room": {imageUrl, roomId, roomName, roomUrl} | null}`

### PUT `/api/registered-room` — 認証必須
Body: `{roomId, roomUrl, inviteCode, imageUrl?, roomName?}`（すべて trim、空は null/必須エラー）。
処理順:
1. 必須 3 項目欠落→400
2. 自分が登録済み→409 `既に登録されているため登録できません`
3. **admin 以外**は他ユーザーの `roomId` または `roomUrl` 一致をチェック→重複なら 409（同メッセージ）
4. トランザクション:
   - `consumeInvitationCode`: 有効コードを `is_deleted=true, used_at=now(JST), used_by_user_id` に更新（updateMany の条件付き更新で楽観排他、count≠1 なら無効扱い）。無効→422 `招待コードが無効です。`
   - `saveUserRegisteredRoom`（upsert、inviteCodeId を紐付け）
   - `ensureUserInvitationCodes`: 登録者本人の発行コードが 3 件になるまで新規生成（重複時 P2002 リトライ最大 10 回）
   - **招待者が admin の場合**: 登録者へ `premiumuser` ロールを upsert 付与＋監査ログ `role.assign`（detail.reason="admin_invite_code"）
   - 監査ログ `room.register`（inviteCode, roomId, roomName, roomUrl）
5. 200 `{"room": {...}}`

### GET `/api/registered-room/check?roomId&roomUrl` — 認証必須
他ユーザーによる登録有無。`{"isDuplicate": bool}`。パラメータ欠落→400。

## 4. 招待コード

### POST `/api/invitations` — admin ロール必須
自分を inviter とするコードを 1 件生成。201 `{"code": "XXXXXXXXXX", "isActive": true}`。

### POST `/api/invitations/verify` — 認証必須（auth() 直接）
Body: `{inviteCode}`。形式は `[A-Z0-9]{10}`（trim + 大文字化してから判定）。
- 有効: `inviteCodeFailureCount=0` にリセット → `{"valid": true}`
- 無効: カウント +1。
  - カウント < 3: `{"valid": false, "remainingAttempts": 3-count}`
  - カウント >= 3: トランザクションで `isBanned=true`＋全セッション削除＋監査ログ `user.ban`（actor=null, detail={reason:"invite_code_failure", failureCount}）→ `{"valid": false, "banned": true}`

## 5. SHOWROOM プロキシ（`lib/showroom/` 経由）

> 全て GET。クエリ欠落→400 `{"error":"<param> is required"}`、上流失敗→502 `{"error":"Failed to fetch upstream API"}`（search のみ `Failed to fetch upstream HTML`）。
> **ルート自体は認証チェックなし**（proxy が未認証をリダイレクトする）。「Auth(Optional)」= セッションがあればブロック済み SHOWROOM ユーザーをフィルタして返す（`getOptionalBlockedUserIds`）。

| エンドポイント | パラメータ | レスポンス | ブロックフィルタ |
| --- | --- | --- | --- |
| `/api/room/search` | `keyword` | `{"rooms": RoomSearchResult[]}`（SHOWROOM の検索 HTML をスクレイピング。`room-url` クラスのアンカーから data-room-id/href/img を抽出、h4.listcardinfo-main-text をルーム名に。roomId+roomUrl で重複排除） | なし |
| `/api/room/profile` | `room_id` | RoomProfile（フラット） | なし |
| `/api/room/status` | `room_url_key` | RoomStatus（フラット） | なし |
| `/api/room/comments` | `room_id` | `{"comments": RoomComment[]}` | あり |
| `/api/room/gifts` | `room_id` | `{"gifts": RoomGiftLog[]}`（30 秒窓のマージ集約済み） | あり |
| `/api/room/paid-gifts` | `room_id` | `{"gifts": RoomGiftLog[]}`（isFree===false のみ） | なし |
| `/api/room/gift-definitions` | `room_id` | `{"gifts": RoomGiftDefinition[]}`（無料ギフト allowlist を先に敷いて上書き） | なし |
| `/api/room/telop` | `room_id` | `{"telop": string\|null}` | なし |
| `/api/room/live-ranking` | `room_id` | `{"ranking": RoomLiveRankingUser[]}`（stage_user_list） | あり |
| `/api/room/total-ranking` | `room_id` | `{"ranking": RoomTotalRankingUser[]}`（summary_ranking） | あり |
| `/api/room/activefan` | `room_id` | ActiveFanSummary（ym=当月 JST `YYYYMM` を付与） | なし |
| `/api/room/eventandsupport` | `room_id` | EventAndSupportSummary | なし |
| `/api/room/user-profile` | `room_id`,`user_id` | `{"profile": RoomUserProfile}`（roomProfile ネスト含む） | なし |
| `/api/live/liveinfo` | `room_id`, `initial?` | RoomLiveInfo。`initial=1` かつ認証済みかつ liveStatus≠1 のとき「配信中のルーム」情報ログを出す | なし |

RoomLiveInfo の癖: `redirect_url` があれば **プレミアムライブ** と判定し `isPremiumLive=true`・`bcsvrKey=null`・`liveStatus=null`。`live_id` 欠落時のプレミアムライブは JST 当日 `YYYYMMDD` を liveId のフォールバックにする。

## 6. オンライブ

### GET `/api/onlive/init` — 認証は実質必須（未認証/ルームなし→`{"status":"no_room"}`）
登録ルームの roomId が正の整数でなければ no_room。
liveInfo / giftDefinitions / comments / gifts / telop / (premium のみ)lastCommentByUser を並列取得（allSettled）。プレミアムライブなら `getBcsvrKeyFromOnlives(roomId)`（onlives 一覧から bcsvr_key を探す）で liveInfo.bcsvrKey を補完。comments/gifts はブロックフィルタ済み。
```json
{"status":"ok","roomId":123,"isPremium":bool,"liveInfo":RoomLiveInfo|null,
 "giftDefinitions":[...],"comments":[...],"gifts":[...],"telop":string|null,
 "lastCommentByUser":{"<showroomUserId>":"JST ISO"}|null}
```
`lastCommentByUser` は `isPremium===true` の場合のみ `getRoomLastCommentMap(roomId)`（`room_user_last_comments` から）を算出し JST ISO 文字列のマップに変換したもの。非 premium は `null`。最終コメントバッジ（[SPEC.md](./SPEC.md) §4.5）の判定に使う。

### GET `/api/onlive/poll?skip_ranking=1?` — 登録ルームなし→404
プロキシの API リクエストログ対象外（高頻度のため明示除外）。
`{"profile":RoomProfile|null,"profileHasError":bool,"liveRanking":[...],"liveRankingHasError":bool,"totalRanking":[...],"totalRankingHasError":bool}`
`skip_ranking=1`（プレミアムライブ時にクライアントが指定）でランキング空＋HasError=true。

### POST `/api/onlive/logs` — 認証必須＋**premiumuser（または admin が premium も持つ場合）必須**＋登録ルーム一致必須
Body: `{roomId, liveId, capturedAt, log}`。capturedAt は `parseJstWallTime` が受ける形式（`YYYY-MM-DD[ T]HH:mm[:ss[.SSS]][Z|±HH:MM]` または Unix ms 数値。タイムゾーン表記は無視して壁時計として解釈）。log は JSON 化可能なオブジェクト必須（undefined/NaN/関数を含むと 400）。
- 登録ルーム不一致→403、`isPremium=false`→403（**admin ロールだけでは不可**。isPremium 判定のため）
- サーバー側で `getRoomTotalRanking` を取得（ブロックフィルタ適用）し、`log.rankings.total` / `totalFetchedAt` / `totalFetchError` と `log.server={savedAt, version:1}` をマージ
- `saveOnliveLog` upsert（UNIQUE(roomId,liveId,capturedAt)。comment_count/gift_count を log から算出）
- 保存成功後、`log.comments`（notice/telop 除く実コメントのみ）からユーザーごとの最新コメント日時を算出し `upsertRoomUserLastComments(roomId, ...)` で `room_user_last_comments` をベストエフォート更新（既存値より新しい場合のみ上書き。失敗しても warn ログのみでレスポンスには影響しない）
- 200 `{"log": {id, capturedAt, updatedAt}}`（JST ISO 文字列）

### GET `/api/onlive/logs/[logId]` — requireUser
admin→任意ログ、それ以外→自ルームのログのみ。`isDeleted=false` 限定。404 / 200 `{capturedAt, liveId, log, roomId}`（JSON ダウンロードにも使うビューア互換形式）。

### PATCH `/api/onlive/logs/[logId]` — requireUser＋(admin または premium)
Body `{title}`（空文字/空白→null=タイトル解除）。admin は全ログ、premium は自ルームのみ。404 / 200 `{"ok":true,"title":...}`。

### DELETE `/api/onlive/logs/[logId]` — requireUser
論理削除（isDeleted=true）。admin は全ログ（isDeleted 済みも count 対象）、一般は自ルームの未削除ログのみ。admin の場合のみ監査ログ `onlive_log.delete`（失敗しても本処理は成功扱い）。404 / 200 `{"ok":true}`。

### PUT `/api/onlive/logs/[logId]/favorite` — requireUser＋(admin または premium)
お気に入りをトグルし 200 `{"ok":true,"isFavorite":bool}`（isFavorite=トグル後の状態）。一般ユーザーは対象ログの roomId が自ルームと一致する場合のみトグルされる。**所有権 NG や存在しない logId でも 404 にはならず `isFavorite:false` の 200 が返る**（`toggleOnliveLogFavorite` が false を返すため）。この挙動は仕様として維持する。

### GET `/api/onlive/logs/bulk-download` — requireUser＋(admin または premium)（**openapi.yaml 未記載**）
admin→全未削除ログ、premium→自ルームの全未削除ログを、各 1 ファイルの JSON（ビューア互換形式、pretty-print）として **fflate の `zipSync`** で ZIP 化。
- エントリ名: `watchlog-{liveId}-{YYYYMMDD-HHmmss(JST)}.json`
- レスポンス: `application/zip`、`Content-Disposition: attachment; filename="watchlog-bulk-{YYYYMMDD(JST)}.zip"`
- 監査ログなし、`一括ダウンロードを実行しました` info ログあり

## 7. ブロック

### GET `/api/blocks` — requireUser
`{"blocks": [{id, blockedUserId, blockedUserName, createdAt, updatedAt}]}`（createdAt desc、JST ISO）。

### POST `/api/blocks` — requireUser
Body `{blockedUserId, blockedUserName}`。**開発者ユーザー（SHOWROOM ID `3699368`）は 403 `開発者はブロックできません`**。upsert（同一相手なら名前更新）。成功時 `revalidateTag("user-blocks-ids-<userId>", "default")` でキャッシュ無効化。200 `{"block": {...}}`。

### DELETE `/api/blocks/[blockId]` — requireUser
自分のブロックのみ削除可。404 / 200 `{"ok":true}`＋revalidateTag。

> ブロック ID 一覧は `unstable_cache`（keyParts=`["blocked-showroom-user-ids", userId]`、tags=`["user-blocks-ids-<userId>"]`、revalidate 60 秒）でキャッシュされる。

## 8. 管理者 API

| エンドポイント | メソッド | 認可 | 概要 |
| --- | --- | --- | --- |
| `/api/admin/users` | GET | `requirePermission("user.read")` | 全ユーザー＋ロール一覧（createdAt desc、JST ISO） |
| `/api/admin/users/[userId]/role` | PATCH | `requirePermission("role.assign")` | Body `{role: "premiumuser"\|"general"}`。premiumuser ロールの付与/剥奪（トランザクション＋監査ログ `role.assign`/`role.remove`）。404=ユーザーなし |
| `/api/admin/users/[userId]/roles` | POST | `requirePermission("role.assign")` | Body `{roleId}`。任意ロールを付与。**`admin` ロールは 403 `Admin role must be assigned directly in the database`**。404=ユーザー/ロールなし。監査ログ `role.assign` |
| `/api/admin/users/[userId]/ban` | PATCH | `requireTopAdminRole()` | Body `{banned: bool}`。自分自身→400 `Cannot ban yourself`、admin 対象→403 `Cannot ban an admin`。BAN 時: セッション全削除。解除時: `inviteCodeFailureCount=0` リセット。監査ログ `user.ban`/`user.unban` |
| `/api/admin/audit-logs` | GET | `requirePermission("audit.read")` | `?limit=`（既定 50、1〜100 にクランプ、非整数は 50）。actor のユーザー情報同梱 |
| `/api/admin/sessions/cleanup` | POST | `requireTopAdminRole()` | `expires < now` のセッションを削除。監査ログ `session.cleanup_expired`。200 `{"deletedCount", "expiredBefore"}` |
| `/api/admin/maintenance` | GET/POST | `requireTopAdminRole()` | 一覧（startsAt desc）/ 作成。POST Body `{title*, message?, startsAt*, endsAt*, isEnabled?=true}`。endsAt<=startsAt→400。監査ログ `maintenance_window.create`。201 |
| `/api/admin/maintenance/[id]` | PATCH/DELETE | `requireTopAdminRole()` | 部分更新（有効期間の整合を既存値とマージして検証）/ 物理削除。監査ログ `maintenance_window.update`/`delete` |
| `/api/admin/notices` | GET/POST | `requireTopAdminRole()` | 一覧 / 作成。POST Body `{title*, content*, displayTarget?=AUTHENTICATED, publishedAt*, expiresAt?, linkUrl?}`。expiresAt<=publishedAt→400。監査ログ `dashboard_notice.create`。201 |
| `/api/admin/notices/[id]` | PATCH/DELETE | `requireTopAdminRole()` | 部分更新 / 物理削除。id は数値（parseInt、NaN→400）。監査ログ `dashboard_notice.update`/`delete` |

※ `/api/admin/notices/route.ts` と `/api/admin/maintenance/route.ts` は `noticeSelect`/`serializeNotice`/`VALID_TARGETS`（および maintenance 版）を **route ファイルから export** しており、`[id]/route.ts` が import している（Next.js の Route Handler で許容される追加 export。再現時は共有モジュールへの分離を推奨するが挙動は同一にすること）。

## 9. SHOWROOM 上流 API（サーバーが叩く外部 API）

> **決定事項**: SHOWROOM API は公式公開仕様ではなく、本書のレスポンス形状は元実装の型定義から逆引きしたもの。**現時点ではこの記載どおりのレスポンス形状を前提に実装してよい**（将来 SHOWROOM 側の変更で壊れるリスクは許容し、変更検知時に追随する）。

`lib/showroom/core.ts` に URL とヘッダーを集約。全リクエストに Chrome 相当の `user-agent` と `accept-language: ja-JP,...` を付ける。`cache: "no-store"`。

| 用途 | URL |
| --- | --- |
| ルームプロフィール | `https://www.showroom-live.com/api/room/profile?room_id=` |
| ルーム状態 | `.../api/room/status?room_url_key=` |
| イベント/サポート | `.../api/room/event_and_support?room_id=` |
| アクティブファン | `.../api/active_fan/room?room_id=&ym=YYYYMM` |
| コメントログ | `.../api/live/comment_log?room_id=` |
| ギフトログ | `.../api/live/gift_log?room_id=` |
| ギフト定義 | `.../api/live/gift_groups?room_id=`（エラー code 1002=プレミアムライブ時は room_id **317313** で再取得するフォールバック） |
| ライブ情報 | `.../api/live/live_info?room_id=` |
| テロップ | `.../api/live/telop?room_id=` |
| ライブランキング | `.../api/live/stage_user_list?room_id=` |
| 累計ランキング | `.../api/live/summary_ranking?room_id=` |
| 配信中一覧 | `.../api/live/onlives` |
| ストリーミング URL | `.../api/live/streaming_url?room_id=&abr_available=1`（type が hls/hls_all のみ、quality 昇順） |
| ユーザープロフィール | `.../api/user/profile?room_id=&user_id=` |
| ルーム検索(HTML) | `https://www.showroom-live.com/room/search?genre_id=0&keyword=` |

画像 URL 変換: `toLargeImageUrl` が `_s.` / `_m.` → `_l.`。アバター URL 生成: `https://image.showroom-cdn.com/showroom-prod/image/avatar/{avatarId}.png`、ギフト画像: `.../assets/img/gift/{giftId}_s.png`。

## 10. SHOWROOM WebSocket（ブラウザ直結）

- URL: `wss://online.showroom-live.com/`
- 購読: `SUB\t<bcsvrKey>` 送信。keepalive: 60 秒ごと `PING\tshowroom`。サーバー応答 `ACK\tshowroom`
- 受信: `MSG\t<key>\t{json}`。payload の `t`（数値/文字列）で分岐:
  - `1`: コメント（cm=本文, ac=名前, u=userId, av=avatarId, cl=classLevel, ua=訪問ステータス, created_at）
  - `2`: ギフト（g=giftId, n=個数, gt=giftType(2=有料), ほか同上）
  - `18`: お知らせ（m=本文。フォロー/ファンレベル/ファン数/初訪問/訪問回数を正規表現で分類）
  - `1001`: ランキングお知らせ（message=本文、「ランキング「…」で…位になりました」）
  - `101`: 配信終了（→ログ保存トリガ）
  - `104`: 配信開始（ダッシュボードの自動遷移トリガ）
  - `telop` フィールドがあればテロップ更新
