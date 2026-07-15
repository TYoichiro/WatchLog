# TASKS.md — 実装タスクリスト

> 各フェーズは前フェーズ完了が前提（明記ある場合を除く）。参照はすべて `Vibe/` 配下。
> **全フェーズ共通の Definition of Done**: `npm run lint && npm run test && npm run build` が通ること。UI 文言・ステータスコードは SPEC/API の記載と一致すること。

## Phase 0: 環境構築

- [ ] Next.js 16.2.9 + TypeScript strict + Tailwind 4 + npm でプロジェクト初期化（CLAUDE.md「技術スタック」参照。`create-next-app@latest` は使わず、バージョンを exact 指定した package.json を起点にする）
- [ ] リポジトリルートに `CLAUDE.md` を作成（内容: 「`Vibe/CLAUDE.md` と `Vibe/prompt.md` の共通ルールに従うこと」への参照＋最重要禁止事項の要約。各セッションが自動読込するため）
- [ ] `tsconfig.json`（`@/*` alias, ES2017 target）・`eslint.config.mjs`（next/core-web-vitals + typescript, `_` ignore）・`postcss.config.mjs` を設定
- [ ] shadcn 導入（components.json: radix-nova / neutral / lucide）と `app/globals.css` のトークン定義（DESIGN.md §1-2 参照）
- [ ] UI プリミティブ 17 種を `components/ui/` に用意（alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, collapsible, dialog, dropdown-menu, input, separator, sheet, sidebar, skeleton, switch, tooltip）
- [ ] `compose.yml` / `compose.dev.yml` / `Dockerfile` / `.dockerignore` / `scripts/thread.ps1` を再現（INFRA.md 参照）
- [ ] `.env` 雛形と `lib/env.ts`（requiredEnv/assertRequiredEnv）（ENV.md 参照）
- [ ] `next.config.ts`（TZ 強制 / standalone / remotePatterns / withAxiom）（INFRA.md §5 参照）
- **DoD**: `docker compose up` で空アプリが :3000 で起動、DB healthcheck 通過

## Phase 1: 時刻基盤とデータモデル

- [ ] `lib/jst.ts`（parseJstWallTime / toJstIsoString / toJstWallTimeDate / formatJstWallDateTime ほか）＋テスト（TEST_PLAN.md §3.1 参照）※最初に実装する
- [ ] `lib/server-timezone.ts`（`-c timezone=Asia/Tokyo`）と `lib/prisma.ts`（adapter-pg シングルトン）
- [ ] `prisma/schema.prisma` 全 16 モデル（DATA_MODEL.md §2 参照。generator 出力先 `app/generated/prisma`）
- [ ] `prisma.config.ts`（datasource url / seed 定義 / TZ 強制）
- [ ] マイグレーション作成: 初期テーブル＋ **updated_at JST トリガー**（DATA_MODEL.md §0, §3 参照）
- [ ] `prisma/seed.ts`（ロール 3・権限 5・ロール権限・お知らせ 4 件）（DATA_MODEL.md §4 参照）
- [ ] `types/domain/json.ts` / `types/api/*` / `types/pages/*` の型定義
- **DoD**: migrate deploy + seed が成功。UPDATE で updated_at が JST 更新されることを SQL で確認

## Phase 2: 認証・認可基盤

- [ ] `auth.ts`（NextAuth v5: Google / PrismaAdapter / DB セッション 180 日 / session callback で user.id / createUser・signIn・signOut イベント）（API.md §1 参照）
- [ ] `types/next-auth.d.ts` のセッション型拡張
- [ ] `app/api/auth/[...nextauth]/route.ts`
- [ ] `lib/audit.ts`（writeAuditLog、トランザクション対応）
- [ ] `lib/authz.ts`（requireUser の BAN チェック含む全ヘルパー）（API.md §0.2 参照）
- [ ] `proxy.ts`（認証ゲート / x-watchlog-pathname / アクセス・API ログ / matcher）（API.md §0.1 参照）※middleware.ts 禁止
- [ ] `lib/logger.ts`（レベル制御 / JST 日付ファイル / コンソール形式 / Axiom 任意）（SPEC.md §9.1 参照）
- [ ] `app/layout.tsx`（メンテナンス→/maintenance、BAN→/banned リダイレクト、Geist、Analytics）（SPEC.md §3.1 参照）
- **DoD**: Google ログイン→users/accounts/sessions 作成＋user ロール付与＋監査ログ 3 種を確認。未認証で保護ページ→`/`

## Phase 3: SHOWROOM 連携層（lib/）

- [ ] `lib/showroom/core.ts`（URL 集約 / UA ヘッダー / fetch ヘルパー / toFiniteNumber / toLargeImageUrl）（API.md §9 参照）
- [ ] `lib/showroom/room.ts`（profile / status / eventAndSupport / activeFan、RANK_TIME_CHARGE_MAP）
- [ ] `lib/showroom/live.ts`（commentLog / telop / liveInfo — プレミアムライブ判定・liveId フォールバック）（SPEC.md §10-5 参照）
- [ ] `lib/showroom/gifts.ts`（定義 / ログ / paid、無料 allowlist・30 秒マージ・1002 フォールバック）
- [ ] `lib/showroom/ranking.ts`（stage_user_list / summary_ranking）
- [ ] `lib/showroom/search.ts`（HTML スクレイピング）
- [ ] `lib/showroom/onlives.ts` / `streaming.ts` / `user.ts` / `index.ts`（re-export）
- [ ] `lib/showroom-realtime.ts`（WS メッセージ定数・パース）（API.md §10 参照）
- [ ] `lib/showroom-users.ts`（DEVELOPER_USER_ID="3699368"）/ `lib/showroom-block-filter.ts`
- **DoD**: TEST_PLAN.md §3.5-3.6 の観点をテストで担保

## Phase 4: ドメインロジック（lib/）

- [ ] `lib/invitations.ts`（生成・検証・消費・補充）（TEST_PLAN.md §3.2 参照）
- [ ] `lib/user-registered-room.ts` / `lib/registered-room.ts`（クライアント fetch ラッパー）
- [ ] `lib/user-blocks.ts`（unstable_cache 60 秒＋tag、開発者ブロック禁止）
- [ ] `lib/dashboard-notices.ts` / `lib/maintenance.ts`
- [ ] `lib/onlive-log.ts`（保存 upsert・一覧 100/500・詳細・前回ログ・タイトル・favorite・論理削除）（SPEC.md §7 参照）
- [ ] `lib/onlive-local-log.ts`（localStorage 3 キー＋レスキュー変換）／ `lib/onlive-summary.ts`（サマリー・比較）
- [ ] `lib/utils.ts`（cn / formatTime）・`lib/version.ts`
- **DoD**: TEST_PLAN.md §3.2-3.4 の観点をテストで担保

## Phase 5: API ルート（API.md の全 30 ルート）

- [ ] ダッシュボード: `/api/dashboard`・`/api/dashboard/notices`（API.md §2 参照）
- [ ] 登録ルーム: GET/PUT `/api/registered-room`・`/check`（消費→補充→admin 招待 premium 付与のトランザクション）（API.md §3 参照）
- [ ] 招待コード: POST `/api/invitations`・`/verify`（3 回失敗 BAN）（API.md §4 参照）
- [ ] SHOWROOM プロキシ 14 本（room 12 + live/liveinfo）（API.md §5 参照）
- [ ] オンライブ: `/api/onlive/init`・`/poll`・`/logs`(POST)・`/logs/[logId]`(GET/PATCH/DELETE)・`/favorite`・`/bulk-download`(fflate ZIP)（API.md §6 参照）
- [ ] ブロック: `/api/blocks`(GET/POST)・`/api/blocks/[blockId]`(DELETE)＋revalidateTag（API.md §7 参照）
- [ ] 管理: users / role / roles / ban / audit-logs / sessions/cleanup / maintenance CRUD / notices CRUD（API.md §8 参照）
- **DoD**: TEST_PLAN.md §3.7 の観点（401/403/400/404/409/422/502、監査ログ）をテストで担保

## Phase 6: フロントエンド基盤

- [ ] `components/navigation/app-sidebar.tsx`（AppShell: ヘッダー/サイドバー/ロール別メニュー/ログアウト）（SPEC.md §3.3 参照）
- [ ] エラーバウンダリ `app/error.tsx`・`app/onlive/error.tsx`（SPEC.md §3.2 参照）
- [ ] `hooks/use-user-blocks.ts`・`use-user-profile.ts`・`use-mobile.ts`
- [ ] `components/notices/notice-list-card.tsx`・UserProfileModal・UserVisitStatusBadge 等の共有部品
- **DoD**: Storybook 不使用のため、コンポーネントテストで表示分岐を担保

## Phase 7: 画面実装（SPEC.md §4 の該当節を参照）

- [ ] `/` ログイン（§4.2）
- [ ] `/search` 検索・招待コード・登録（§4.3）
- [ ] `/dashboard`（キャッシュ・レスキューバナー・WS 開始検知）（§4.4）
- [ ] `/onlive`（WS・ポーリング・スナップショット・自動保存・各ダイアログ）（§4.5）※最大工数。オンライブとログビューアは同一コンポーネント群を共有する
- [ ] `/logs` 一覧（お気に入り・タイトル編集・ページング・インポート・一括 DL）（§4.6）
- [ ] `/logs/[logId]`・`/logs/local/[roomId]`・`/logs/json-import`＋配信サマリー（§4.7）
- [ ] `/block`（§4.8）・`/settings`（§4.9）
- [ ] `/showtube`・`/showtube/watch`（hls.js）（§4.10）
- [ ] `/rescue`（ssr:false）（§4.11）
- [ ] `/admin/users`・`/admin/rooms`・`/admin/notices`・`/admin/maintenance`（§4.12）
- [ ] `/maintenance`・`/banned`（§4.13）
- **DoD**: SPEC.md の文言・遷移・権限マトリクス（§2.3）どおり動作。TEST_PLAN.md §3.8 担保

## Phase 8: 外部連携・非機能

- [ ] Vercel Analytics / Speed Insights / next-axiom 組み込み（SPEC.md §8 参照）
- [ ] ログ出力の全経路確認（ファイル/コンソール/proxy の API ログ）（SPEC.md §9.1 参照）
- [ ] 監査ログ action 全 16 種の書き込み確認（SPEC.md §9.4 参照）
- [ ] `scripts/backfill-onlive-log-counts.ts`（DATA_MODEL.md §5 参照）
- **DoD**: logs/YYYY-MM-DD.log に JSON Lines が出る。audit_logs に各操作が記録される

## Phase 9: テスト整備・最終検証

- [ ] `vitest.config.mts` / `vitest.setup.ts` / `test-utils/mocks/`（auth, next-link, hls）（TEST_PLAN.md §1 参照）
- [ ] 全ソース併置テストの移植（TEST_PLAN.md §3 の観点網羅）
- [ ] 未カバー領域（TEST_PLAN.md §4）の手動検証: OAuth 実ログイン、メンテナンス/BAN リダイレクト、実配信での WS 受信・ログ保存、ZIP ダウンロード
- [ ] README 相当のセットアップ手順検証（compose 起動・seed・thread.ps1）
- **DoD**: `npm run lint && npm run test && npm run build` 全通過、手動シナリオ（登録→配信→保存→閲覧→ダウンロード）完走

## Phase 10: デプロイ設定（自前 Docker 運用 — 決定事項）

- [ ] Dockerfile 3 ステージビルドでイメージ作成・起動確認（INFRA.md §4 参照）
- [ ] 本番相当の compose 起動確認（migrate → build → start、INFRA.md §2 参照）
- ※ Vercel へのデプロイは行わない（`VERCEL` 検出コードは互換のため実装として残すのみ）
- **DoD**: `docker build` 成功、`node server.js` で起動し全機能動作
