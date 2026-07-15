# prompt.md — フェーズ別実行プロンプト集

WatchLog 再実装を**フェーズごとに新しいセッション**で進めるためのプロンプト集です。
各フェーズのコードブロックをそのままコピーして、新しい Claude Code セッションに貼り付けてください。
最後に、Phase 0〜10 を**一括で自動実行**するプロンプトもあります。

> 前提: 実装先リポジトリのルートに `Vibe/` フォルダ（CLAUDE.md / SPEC.md / TASKS.md / API.md / DATA_MODEL.md / ENV.md / INFRA.md / DESIGN.md / TEST_PLAN.md / prompt.md）が存在すること。
> リポジトリはそれ以外**空でよい**（`git init` 済み推奨）。`npx create-next-app` は実行しないこと — バージョン固定（Next.js 16.2.9 等）と規約に沿った初期化は Phase 0 のセッションが行う。最新版の boilerplate が入ると Vibe の規約と食い違い、かえって手戻りになる。

---

## 共通ルール（各セッションがフェーズ開始前に必ず読む）

各フェーズのプロンプトは、このセクションを読むよう指示しています。内容:

1. **情報源は `Vibe/` 配下のドキュメントのみ**。元実装（WatchLog）のソースコードが手元にあっても参照・コピーしない。Next.js の API 仕様は `node_modules/next/dist/docs/` の同梱ドキュメントを読む。
2. 作業開始前に `Vibe/CLAUDE.md`（全体ガイド）と `Vibe/TASKS.md` の該当フェーズを読む。フェーズ内の各タスクに「(◯◯.md §N 参照)」とある参照先は、実装前に必ず読む。
3. **前フェーズの完了確認**: `Vibe/TASKS.md` のチェック状況と `Vibe/PROGRESS.md`（存在すれば）を確認する。前フェーズが未完了の場合は実装せず、その旨を報告して停止する（Phase 0 を除く）。
4. **タスク管理**: タスクを完了するたびに `Vibe/TASKS.md` の該当チェックボックスを `- [x]` に更新する。
5. **進捗の引き継ぎ**: フェーズ完了時に `Vibe/PROGRESS.md` へ追記する（なければ作成）。書式:
   ```markdown
   ## Phase N — 完了 (YYYY-MM-DD)
   - 実装内容の要約（ファイル/機能単位）
   - 仕様からの逸脱・判断した点（あれば理由付き）
   - 未解決・手動確認待ちの項目
   - 次フェーズへの申し送り
   ```
6. **Definition of Done**: 各フェーズの DoD（TASKS.md 記載）と、共通 DoD `npm run lint && npm run test && npm run build` 全通過（Phase 0 など package.json 整備前は可能な範囲で）を満たすまで終了しない。テスト失敗を放置・スキップしない。
7. **文言・挙動の忠実再現**: UI の日本語文言、HTTP ステータスコード、リダイレクト先、localStorage キーは `Vibe/SPEC.md` / `Vibe/API.md` の記載と一字一句一致させる（テストが文言に依存する）。
8. **禁止事項**（CLAUDE.md「開発時の注意点」より）: `middleware.ts` を作らない（`proxy.ts`）／`next/image` を使わない（`<img>`）／`@prisma/client` から直接 import しない（`@/app/generated/prisma/client`）／タスク範囲外のリファクタリングをしない。
9. **判断に迷ったら**: SPEC/API/DATA_MODEL を再読し、それでも決められない場合は最も保守的な実装（元仕様に近い方）を選び、PROGRESS.md の「逸脱・判断」に記録する。ユーザーへの質問で作業を止めない。
10. **実環境の資格情報**（Google OAuth、実 DB、実 SHOWROOM 配信）が必要な検証は、ダミー値でビルド・テストまで行い、実地確認は PROGRESS.md に「手動確認待ち」として記録して先へ進む。

---

## Phase 0: 環境構築

```text
WatchLog 再実装プロジェクトの Phase 0（環境構築）を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う
2. Vibe/CLAUDE.md と Vibe/TASKS.md の「Phase 0: 環境構築」を読む
3. Phase 0 の全タスクを実装する。主な参照先: Vibe/CLAUDE.md（技術スタック・ディレクトリ構成）、Vibe/DESIGN.md §1-2（globals.css・shadcn）、Vibe/INFRA.md（compose/Dockerfile/thread.ps1）、Vibe/ENV.md（.env 雛形・lib/env.ts）

完了条件（DoD）: docker compose up で空アプリが :3000 で起動し DB healthcheck が通ること。Docker が使えない環境の場合は npm run dev での起動確認に代替し、その旨を PROGRESS.md に記録すること。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、実施内容を報告して終了してください。
```

## Phase 1: 時刻基盤とデータモデル

```text
WatchLog 再実装プロジェクトの Phase 1(時刻基盤とデータモデル)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 1」を読む
3. 全タスクを実装する。主な参照先: Vibe/DATA_MODEL.md(§0 JST 規約は最重要。§2 テーブル定義、§3 migration、§4 seed)、Vibe/TEST_PLAN.md §3.1(lib/jst のテスト観点)

重要: lib/jst.ts を最初に実装し、TEST_PLAN.md §3.1 の観点をテストで固めてから他へ進むこと。updated_at は Prisma の @updatedAt ではなく DB トリガーで実装すること。

完了条件(DoD): prisma migrate deploy + seed が成功し、UPDATE で updated_at が JST 更新されることを SQL で確認。lint/test/build 通過。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、報告して終了してください。
```

## Phase 2: 認証・認可基盤

```text
WatchLog 再実装プロジェクトの Phase 2(認証・認可基盤)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 2」を読む
3. 全タスクを実装する。主な参照先: Vibe/API.md §0(proxy と authz の仕様)・§1(NextAuth 設定とイベント)、Vibe/SPEC.md §3.1(root layout のリダイレクト)・§5(セッション仕様)・§9.1(ログ仕様)、Vibe/TEST_PLAN.md §3.3

重要: middleware.ts ではなく proxy.ts を作ること。requireUser は DB の isBanned チェックを含むこと。auth.ts の createUser イベントで user ロール付与と監査ログをトランザクションで行うこと。

完了条件(DoD): (可能なら実 Google OAuth で)ログイン時に users/accounts/sessions 作成＋user ロール付与＋監査ログ 3 種を確認。未認証で保護ページ→「/」リダイレクト。実 OAuth 資格情報がない場合はテストでの検証にとどめ、手動確認待ちとして記録。lint/test/build 通過。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、報告して終了してください。
```

## Phase 3: SHOWROOM 連携層

```text
WatchLog 再実装プロジェクトの Phase 3(SHOWROOM 連携層)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 3」を読む
3. lib/showroom/ 一式と lib/showroom-realtime.ts などを実装する。主な参照先: Vibe/API.md §9(上流 API 一覧・ヘッダー・URL 変換)・§10(WebSocket プロトコル)、Vibe/SPEC.md §10(プレミアムライブ・無料ギフト allowlist・30 秒マージ等の癖)、Vibe/TEST_PLAN.md §3.5-3.6

重要: UA/accept-language ヘッダーを全リクエストに付与。プレミアムライブ判定(redirect_url)・liveId フォールバック(JST YYYYMMDD)・gift_groups の 1002 エラー時 room 317313 フォールバック・ギフト 30 秒マージを忠実に再現すること。テストは実 API を呼ばずモックで行うこと。

完了条件(DoD): TEST_PLAN.md §3.5-3.6 の観点がテストで担保されている。lint/test/build 通過。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、報告して終了してください。
```

## Phase 4: ドメインロジック

```text
WatchLog 再実装プロジェクトの Phase 4(ドメインロジック)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 4」を読む
3. lib/ のドメインロジック一式を実装する。主な参照先: Vibe/SPEC.md §6(ブロック)・§7(配信ログデータ)、Vibe/API.md §3-§8 の該当 lib 挙動、Vibe/TEST_PLAN.md §3.2-3.4

重要: 招待コードの消費は updateMany の条件付き更新(count≠1 で無効エラー)。ブロック ID 一覧は unstable_cache(60 秒＋tag)。onlive-log の一覧上限(admin 500/一般 100)と論理削除・所有権分岐を忠実に再現すること。

完了条件(DoD): TEST_PLAN.md §3.2-3.4 の観点がテストで担保されている。lint/test/build 通過。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、報告して終了してください。
```

## Phase 5: API ルート

```text
WatchLog 再実装プロジェクトの Phase 5(API ルート全 30 本)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 5」を読む
3. app/api/**/route.ts を Vibe/API.md の全仕様どおり実装する。エンドポイント一覧は Vibe/SPEC.md §7.5、詳細は Vibe/API.md §1-§8。テスト観点は Vibe/TEST_PLAN.md §2(モックパターン)・§3.7

重要: 全ルートに export const dynamic = "force-dynamic"。ステータスコード(400/401/403/404/409/422/502)とエラーメッセージ文言を API.md と一致させる。registered-room PUT のトランザクション(消費→補充→admin 招待の premium 付与)、invitations/verify の 3 回失敗 BAN、onlive/logs POST の premium チェックと total ranking マージ、bulk-download の ZIP(fflate)を忠実に再現。監査ログの action 名は SPEC.md §9.4(9.2)の一覧どおり。

完了条件(DoD): TEST_PLAN.md §3.7 の観点(認可・バリデーション・正常系・監査ログ)がテストで担保されている。lint/test/build 通過。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、報告して終了してください。
```

## Phase 6: フロントエンド基盤

```text
WatchLog 再実装プロジェクトの Phase 6(フロントエンド基盤)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 6」を読む
3. AppShell・エラーバウンダリ・共有 hooks・共有部品を実装する。主な参照先: Vibe/SPEC.md §3.2-3.3(エラーバウンダリ・AppShell 仕様)・§4.5(UserProfileModal・訪問バッジ)、Vibe/DESIGN.md(レイアウト・色・a11y)、Vibe/TEST_PLAN.md §3.8

重要: サイドバーのロール別メニュー(共通 4 項目/プレミア機能/管理者 4 項目)、ヘッダーの APP_VERSION 表示、/onlive でのブランドリンク無効化、xl ブレークポイントでのドロワー/常設切替を再現すること。

完了条件(DoD): コンポーネントテストで表示分岐(ロール別メニュー・active 状態・ログアウト)が担保されている。lint/test/build 通過。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、報告して終了してください。
```

## Phase 7: 画面実装

```text
WatchLog 再実装プロジェクトの Phase 7(画面実装・全 20 画面)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 7」を読む
3. TASKS.md 記載の順に画面を実装する。各画面の仕様は Vibe/SPEC.md §4 の該当節(§4.2〜§4.13)を必ず精読してから着手する。文言・遷移・権限は §2.3 権限マトリクスと一致させる。テスト観点は Vibe/TEST_PLAN.md §3.8

重要:
- /onlive が最大工数。WebSocket 処理・localStorage スナップショット・配信終了時の自動保存(premium=API/非 premium=localStorage)・重複排除/マージ・各ダイアログを SPEC §4.5 どおりに。オンライブとログビューア(§4.7)はコンポーネント群を共有する
- localStorage キー 4 種(SPEC §3.4)を正確に
- 検索画面の招待コードモーダルは検証成功まで閉じられない(§4.3)
- ダッシュボードの WS 配信開始検知は admin では行わない(§4.4)

完了条件(DoD): SPEC.md の文言・遷移・権限マトリクスどおり動作し、TEST_PLAN.md §3.8 の観点がテストで担保されている。lint/test/build 通過。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、報告して終了してください。
```

## Phase 8: 外部連携・非機能

```text
WatchLog 再実装プロジェクトの Phase 8(外部連携・非機能)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 8」を読む
3. 計測(Analytics/Speed Insights/next-axiom)・ログ全経路・監査ログ・バックフィルバッチを整備する。主な参照先: Vibe/SPEC.md §8(外部連携)・§9(非機能)、Vibe/DATA_MODEL.md §5(バッチ)

完了条件(DoD): logs/YYYY-MM-DD.log に JSON Lines が出力される。audit_logs に各操作(SPEC §9.4 の action 一覧)が記録される。lint/test/build 通過。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、報告して終了してください。
```

## Phase 9: テスト整備・最終検証

```text
WatchLog 再実装プロジェクトの Phase 9(テスト整備・最終検証)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 9」を読む
3. Vibe/TEST_PLAN.md 全体を精読し、§1 のテスト基盤(vitest.config.mts / vitest.setup.ts / test-utils/mocks)と §3 の全観点を満たすテストを整備する。§4 の未カバー領域は手動検証項目として PROGRESS.md に列挙する
4. Vibe/TASKS.md 全フェーズのチェック状況を棚卸しし、未完了があれば完了させる

完了条件(DoD): npm run lint && npm run test && npm run build 全通過。手動シナリオ(登録→配信→保存→閲覧→ダウンロード)の実施結果または「手動確認待ち」一覧を PROGRESS.md に記録。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、報告して終了してください。
```

## Phase 10: デプロイ設定（自前 Docker 運用）

```text
WatchLog 再実装プロジェクトの Phase 10(デプロイ設定・自前 Docker 運用)を実行してください。

手順:
1. Vibe/prompt.md の「共通ルール」を読み、以後それに従う(前フェーズ完了確認を含む)
2. Vibe/TASKS.md の「Phase 10」を読む
3. Dockerfile 3 ステージビルドの検証を行う。主な参照先: Vibe/INFRA.md §4(Dockerfile)・§5(next.config)、Vibe/ENV.md §4(ビルド専用ダミー値)

完了条件(DoD): docker build が成功し、node server.js で起動して主要画面が表示される。Docker が使えない場合は npm run build && npm run start(standalone)での確認に代替し記録する。
完了したら TASKS.md のチェック更新と PROGRESS.md への追記を行い、最終報告して終了してください。
```

---

## 一括自動実行プロンプト（Phase 0〜10 を 1 セッションで Auto 実行）

```text
WatchLog 再実装プロジェクトを Phase 0 から Phase 10 まで一括で自動実行してください。途中でユーザーへの質問や確認で停止せず、最後まで自律的に進めてください。

進め方:
1. まず Vibe/prompt.md の「共通ルール」、Vibe/CLAUDE.md、Vibe/TASKS.md を読む
2. Vibe/TASKS.md の Phase 0 → 1 → 2 → … → 10 の順に、各フェーズの全タスクを実装する。各タスクの「(◯◯.md §N 参照)」の参照先を実装前に必ず読むこと
3. フェーズごとに DoD を検証し(共通 DoD: npm run lint && npm run test && npm run build)、通過するまで修正してから次のフェーズへ進む。失敗を放置して先へ進まない
4. フェーズ完了ごとに Vibe/TASKS.md のチェックボックスを更新し、Vibe/PROGRESS.md に完了記録(実装要約・逸脱と理由・手動確認待ち・申し送り)を追記する
5. 実行環境の制約への対処:
   - Google OAuth の実資格情報がない場合: .env にはダミー値を置き、認証まわりはテストで検証。実ログイン確認は PROGRESS.md に「手動確認待ち」として記録
   - Docker が使えない場合: compose/Dockerfile はファイルとして作成し、起動確認は npm run dev / npm run start で代替して記録
   - 実 SHOWROOM API/WebSocket への接続確認は行わない(すべてモックでテスト)
6. 判断に迷う仕様は Vibe/SPEC.md・Vibe/API.md・Vibe/DATA_MODEL.md を正とし、それでも不明な場合は元仕様に最も近い保守的な実装を選んで PROGRESS.md に判断理由を記録する。ユーザーに質問して止まらない
7. コンテキストが長くなっても中断せず継続する

厳守事項: 情報源は Vibe/ 配下のドキュメントと node_modules/next/dist/docs/ のみ(元実装コードを参照しない)。middleware.ts 禁止(proxy.ts を使う)。next/image 禁止(<img> を使う)。Prisma は @/app/generated/prisma/client から import。UI 文言・ステータスコード・localStorage キーは SPEC/API と一字一句一致させる。

最終報告として、全フェーズの完了状況・テスト結果(件数)・手動確認待ち一覧・既知の課題をまとめて出力してください。
```
