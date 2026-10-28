# TEST_PLAN.md — テスト計画（再現すべき受け入れ基準）

> 出典: 既存の Vitest テスト（**約 120 ファイル、全ソースにほぼ 1:1 で併置**）と `vitest.config.mts` / `vitest.setup.ts` / `test-utils/`。
> 新実装ではこれらのテストが担保している挙動を受け入れ基準として引き継ぐ。

## 1. テスト基盤（元実装の構成）

- **Vitest 4** + `@vitejs/plugin-react` + jsdom + Testing Library（React/DOM）
- `vitest.config.mts`:
  - `test.environment: "jsdom"`, `globals: true`, include `**/*.test.{ts,tsx}`
  - `test.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"`（実 DB 接続はしない）
  - alias: `next/link`→`test-utils/mocks/next-link.tsx`（素の `<a>`）、`hls.js`→`test-utils/mocks/hls.ts`（isSupported=false のスタブ）、`@/auth`→`test-utils/mocks/auth.ts`（auth()=null 等の no-op。**各テストが `vi.mock("@/auth")` で上書き**）、`next/server`→実物
- `vitest.setup.ts` の jsdom ポリフィル: `HTMLAnchorElement.prototype.click` no-op（Blob ダウンロード対策）、`Element.prototype.scrollIntoView/scrollTo` no-op、`global.ResizeObserver` スタブ
- 命名: `foo.ts`→`foo.test.ts`、`Bar.tsx`→`Bar.test.tsx`（同ディレクトリ併置）

## 2. テストパターン（実例: `app/api/invitations/verify/route.test.ts`）

Route Handler テストは **`vi.hoisted` + `vi.mock` で `@/auth`・`@/lib/prisma`・`@/lib/logger`・`@/lib/audit`・lib 関数をモック**し、`NextRequest` を直接組み立てて `POST(request)` を呼び、status/body/モック呼び出しを検証する。
（注: ルート `CLAUDE.md` は「route handler テストで Prisma をモックしない」と書くが、実テストはモックしている。実態を正とする。）

コンポーネントテストは Testing Library で render し、`fetch` を `vi.stubGlobal`/`vi.fn` でモックして文言・遷移・楽観更新を検証する。

## 3. 領域別の必須テスト観点（元テストが担保している挙動）

### 3.1 lib/jst（時刻処理）— 最重要
- `parseJstWallTime`: `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` / `T` 区切り / 秒・ミリ秒付き / `Z`・`±HH:MM` 付き（**タイムゾーン表記は無視して壁時計として解釈**）/ 数値(ms) を受理。存在しない日付（2/30 等）・不正文字列は null
- `toJstIsoString`/`toJstWallTimeIsoString` が `+09:00` 付き ISO を返す
- `createJstWallTimeDate` は不正入力で throw

### 3.2 lib/invitations
- コード生成: 長さ 10、`[A-Z0-9]` のみ。UNIQUE 衝突（P2002）で最大 10 回リトライ、超えたら throw
- `normalize`: trim＋大文字化。`isInvitationCodeFormatValid`: `^[A-Z0-9]{10}$`
- `isInvitationCodeAvailable`: 未存在/削除済み/使用済みは false
- `consumeInvitationCode`: 有効コードを is_deleted/used_at/used_by で更新。updateMany count≠1 なら `InvalidInvitationCodeError`(422)
- `ensureUserInvitationCodes`: 既存数との差分だけ生成（上限 3）

### 3.3 lib/authz
- `requireUser`: セッションなし→Unauthorized、BAN→Forbidden("Banned")
- `hasPermission`/`hasRole`/`getUserRoles`/`requireTopAdminRole`/`requirePermission`
- `authzErrorResponse`: 401/403 変換、他は null

### 3.4 lib/onlive-log / onlive-summary / onlive-local-log
- saveOnliveLog: upsert キー(roomId,liveId,capturedAt)、comments/gifts 配列長→counts
- 一覧: admin 500 件/一般 100 件、isFavorite 付与、roomName 解決
- タイトル更新・削除・favorite の所有権分岐（admin バイパス）
- `getPreviousOnliveLog`: capturedAt 直前の未削除ログ
- サマリー集計: notice(follow→新規フォロー数 / firstVisit→初見数)・telop はコメント数から除外、userId null は `name:` キーで集約、トップ 5、無料ギフト point0→1pt、比較 delta 計算
- ローカルログ/JSON ビューア/レスキュースナップショットの読み書き・検証・変換（不正 JSON は null、SSR では null）

### 3.4.1 lib/room-user-last-comment（最終コメントバッジ）
- `upsertRoomUserLastComments`: 0 件は no-op（findMany/`$transaction` 未呼び出し）、同一ユーザーの複数コメントは最新日時のみ書き込み、既存の `lastCommentAt` より古い日時は更新しない、既存より新しい／未登録ユーザーは upsert する
- `getRoomLastCommentMap`: `showroomUserId → lastCommentAt` の Map を返す（該当なしは空 Map）
- `extractRoomUserCommentsFromLog`: notice/telop 行・userId 欠落・createdAt 欠落を除外し、`createdAt`(UNIX 秒) を `toJstWallTimeDate` で JST 壁時計 Date に変換する。配列でない入力は空配列
- `POST /api/onlive/logs`: 保存成功後に `extractRoomUserCommentsFromLog`→`upsertRoomUserLastComments` を呼び出す、更新失敗時も 200 を返し warn ログのみ
- `GET /api/onlive/init`: premium のときのみ `getRoomLastCommentMap` を呼び `lastCommentByUser` を JST ISO 文字列マップで返す、非 premium は呼ばず null

### 3.5 lib/showroom/*
- 各 API ラッパー: レスポンスのスネークケース→キャメルケース正規化、数値/文字列両対応（`toFiniteNumber`）、trim・フォールバック（name→"Unknown" 等）
- room: RANK_TIME_CHARGE_MAP の対応、activefan の ym=JST 当月
- live: プレミアムライブ判定（redirect_url）、liveId フォールバック（JST YYYYMMDD）、telop 空→null
- gifts: 無料 allowlist、point=0 無料の totalPoint=count、30 秒マージ（境界値 30/31 秒）、gift_groups の 1002 エラー→room 317313 フォールバック
- search: HTML パース（room-url クラス、data-room-id、data-src 優先、HTML エンティティデコード、`/r/` プレフィックス除去、重複排除）
- onlives/streaming: hls/hls_all のみ・quality 昇順、`getBcsvrKeyFromOnlives`
- 上流 !ok → throw（ルートが 502 に変換）

### 3.6 lib/showroom-realtime / showroom-block-filter / user-blocks / dashboard-notices / maintenance / env / audit / utils
- WS メッセージ: `MSG\t<key>\t{json}` 抽出、ACK/デコード不能文字列は null、t=104 判定
- ブロックフィルタ: 空 Set は元配列コピー、userId null は残す
- user-blocks: 開発者 ID で `DeveloperBlockForbiddenError`、upsert・削除の所有権
- notices: surface 別 displayTarget、公開/失効ウィンドウ、linkUrl の http(s) 検証
- maintenance: アクティブ判定境界（starts_at<=now<ends_at）、期間文字列フォーマット
- env: 欠落で throw。utils: `formatTime` の JST 日本語形式・null→「未定」

### 3.7 API Route（全 30 ルートにテストあり）
各ルートで: 未認証 401 / 権限 403 / バリデーション 400 / 404 / 正常系 / 上流 502 / 監査ログ・logger 呼び出し。特に:
- registered-room PUT: 重複 409（自分・他人）、admin バイパス、招待コード消費→補充→admin 招待の premium 付与、422
- invitations/verify: 成功でカウントリセット、失敗インクリメント、3 回目で BAN＋セッション削除＋監査（actor=null）
- onlive/logs POST: 非 premium 403、ルーム不一致 403、total ranking マージ（失敗時 totalFetchError）、capturedAt パース
- admin/users/[id]/ban: 自分 400、admin 対象 403、BAN でセッション削除、解除で failureCount リセット
- admin/users/[id]/roles: admin ロール 403
- bulk-download: ZIP ヘッダー、admin/premium 分岐、権限 403
- audit-logs: limit クランプ（1〜100、既定 50）

### 3.8 ページ・コンポーネント
- ログイン: notices 失敗でもレンダリング（hasError バッジ）
- 検索: 招待コードモーダルのバリデーション文言・残り回数・BAN 遷移、重複エラーモーダル、登録成功で /dashboard replace
- ダッシュボード: no_room/is_live リダイレクト、キャッシュ表示、レスキューバナー（premium/admin のみ）、WS 開始検知
- オンライブ: 初期化リダイレクト、WS コメント/ギフト/通知/終了処理、重複排除・マージ、メトリクス表示・delta、ログ自動保存（premium=API/非 premium=localStorage）、各ダイアログ、最終コメントバッジ（premium かつ設定 ON のときのみ・配信中の初回コメント行のみ）
- 設定モーダル（LiveSettingsModal）: お知らせ通知トグルの表示/ON-OFF、「〇日ぶり・初コメバッジ」トグルは isPremium=true のときのみ表示されコールバックが呼ばれる
- ログ一覧: 非 premium のローカル 1 件表示、お気に入り楽観更新ロールバック、タイトル編集（Enter/Esc/空）、ページング境界、JSON インポート検証文言、一括 DL
- ログ詳細ビューア: スナップショットマージ、サマリー・前回比較、ブロックフィルタ
- ブロック一覧: 一覧・削除・プロフィールモーダル連携、エラー文言
- 管理 4 画面: CRUD・楽観 UI・状態バッジ・BAN/ロールセレクトの無効化条件
- ShowTube: ジャンルフィルタ・重複排除・オフライン表示・画質切替・WS コメント上限 300
- レスキュー: スキャン検証・復旧成功/失敗表示・削除・ダウンロード
- AppShell: ロール別メニュー表示・active 状態・ログアウト
- UI プリミティブ 17 種の基本レンダリング

## 4. テストが存在しない/薄い領域（新実装での検証観点として引き継ぐ）

- **実 DB を使った統合テスト**（マイグレーション・トリガー・UNIQUE 制約の実挙動。JST トリガーは SQL レベルの検証なし）
- E2E（Playwright 等）は未導入。OAuth ログインフロー・proxy リダイレクト・メンテナンスリダイレクトの結合動作
- `lib/logger.ts`（ファイル出力・Axiom）と `proxy.ts` 自体の単体テストなし
- `prisma/seed.ts` / `scripts/backfill-onlive-log-counts.ts` / `scripts/thread.ps1`
- 実 SHOWROOM API/WS との契約テスト（全て手書きモック）
- ビジュアルリグレッション

## 5. 実行コマンド

```bash
npm run test        # 単発
npm run test:watch  # watch
npm run lint && npm run test && npm run build   # コミット前の検証シーケンス
```
