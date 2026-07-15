# DESIGN.md — デザインシステム

> 出典: `app/globals.css` / `components.json` / 各コンポーネントの Tailwind クラス / `app/layout.tsx`

## 1. 基盤

- **Tailwind CSS 4**（`@import "tailwindcss"` 方式。tailwind.config.js は存在しない）＋ `tw-animate-css` ＋ `shadcn/tailwind.css`
- **shadcn スタイルの UI プリミティブ**（`components/ui/`、style: `radix-nova`、baseColor: `neutral`、cssVariables: true、iconLibrary: `lucide`）
  - 実在プリミティブ: alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, collapsible, dialog, dropdown-menu, input, separator, sheet, sidebar, skeleton, switch, tooltip（各テスト付き）
  - Radix UI は統合パッケージ `radix-ui` を使用
- **フォント**: Geist Sans（`geist/font/sans`、`--font-sans`）。等幅は `--font-geist-mono` 参照（招待コード等に `font-mono`）
- **`<html lang="ja">`**。`.dark` バリアント定義はあるが**テーマ切替 UI はなく実質ライトのみ**

## 2. カラートークン（globals.css、oklch）

shadcn 標準の neutral ベース。主要値:

| トークン | ライト | ダーク(定義のみ) |
| --- | --- | --- |
| --background / --foreground | `oklch(1 0 0)` / `oklch(0.145 0 0)` | 反転 |
| --primary / --primary-foreground | `oklch(0.205 0 0)` / `oklch(0.985 0 0)` | 反転気味 |
| --destructive | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| --border / --input / --ring | `oklch(0.922 0 0)` ×2 / `oklch(0.708 0 0)` | 白の 10%/15% |
| --radius | `0.625rem`（sm=×0.6 … 4xl=×2.6） | — |

実際の画面は トークンより **slate 系ユーティリティ直書き** が支配的:
- 背景: `bg-slate-100`（アプリ全体）、カード `bg-white`
- テキスト: `text-slate-900/950`（見出し）、`text-slate-500/600`（補足）
- アクティブナビ: `bg-slate-900 text-white`

## 3. 意味色の使い分け（Tailwind パレット直指定）

| 用途 | 色 |
| --- | --- |
| エラー/削除/BAN | rose・red（`bg-rose-50 border-rose-100 text-rose-700` 等） |
| 成功/許可/訪問通知 | emerald |
| 注意/レスキューバナー/テロップバー/メンテ | amber（テロップバーは `bg-amber-50`） |
| 情報/初見バッジ/ファンレベル通知 | sky |
| 開発者バッジ | violet |
| ファン数通知 | pink、ランキング通知 | yellow、フォロー通知 | rose |
| お気に入りハート | pink-500 |
| メトリクスカードのアイコン地 | amber(ポイント)/sky(フォロワー)/emerald(盛り上がり)/violet(開始時間) |
| 増減バッジ | 増=emerald、減=rose、変化なし=slate |

## 4. ドメイン固有の定数表示

- SHOW ランク→時給表（`lib/showroom/room.ts` の `RANK_TIME_CHARGE_MAP`）: SS-5=¥10,000 … B-5=¥30（コード内テーブルをそのまま維持）
- 訪問ステータスバッジ: ua=2「初見」sky / ua=1「ビギナー」emerald / 開発者(3699368) は violet で「開発者（初見/ビギナー/なし）」
- 数値は `Intl.NumberFormat("ja-JP")` でカンマ区切り。日時表示は `Intl.DateTimeFormat("ja-JP", {timeZone:"Asia/Tokyo", hour12:false, ...})`

## 5. レイアウトパターン

- AppShell: サイドバー w-72（xl 以上常設・トグル、未満はドロワー＋オーバーレイ `bg-slate-900/40`）、ヘッダー h-16 sticky `bg-white/95 backdrop-blur`、メイン `p-4 gap-4`。xl 以上は `h-screen overflow-hidden`（オンライブ・検索はメイン内スクロール）
- カード角丸: ダッシュボード/オンライブ系は `rounded-3xl border-0 shadow-sm`、一覧系は `rounded-lg border-slate-200`
- モーダル: Radix Dialog / AlertDialog。閉じ不可ダイアログは `onEscapeKeyDown/onPointerDownOutside` を preventDefault
- レスポンシブ分岐点: `sm`(640)・`min-[600px]`・`lg`(1024)・`xl`(1280、サイドバー/2 ペイン切替)・`2xl`。モバイル判定 hook は 768px（`hooks/use-mobile.ts`）
- スケルトン: `animate-pulse bg-slate-100/200` をカード形状で敷く（Skeleton コンポーネント併用）

## 6. アクセシビリティ慣行

- モーダルに `role="dialog"` `aria-modal` `aria-labelledby`（手書きモーダル）または Radix 標準
- クリック可能な行に `role="button"` `tabIndex=0`＋Enter/Space ハンドラ
- アイコンに `aria-hidden`、操作ボタンに `aria-label`（メニュー開閉・お気に入り等）
- `aria-current="page"`（ナビ）、`aria-pressed`（タブ切替）

## 7. 文言トーン

丁寧体の日本語。エラーは「〜できませんでした。時間をおいて再試行してください。」形式。確認は「〜しますか？」＋「はい/いいえ」。固有文言は [SPEC.md](./SPEC.md) §4 に画面ごとに記載（そのまま使用すること）。
