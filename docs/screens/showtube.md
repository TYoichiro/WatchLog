# ShowTube（ライブ一覧）画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/showtube`、`/showtube?genre={genreId}` |
| レンダリング | Server Component（`force-dynamic`） |
| 認証要否 | 必要（未認証時は `/` へリダイレクト） |
| 権限要否 | `admin` または `premiumuser` ロール（不足時は `/dashboard` へリダイレクト） |
| ページタイトル | `ShowTube \| WatchLog` |
| ナビゲーション | `ShowTubeShell`（サイドバー・ヘッダー） |
| バージョン表記 | `APP_VERSION`（`lib/version.ts` から動的生成。`package.json` の `version` フィールドを使用） |

SHOWROOM の現在配信中のルームをジャンル別に一覧表示する画面です。各カードをクリックすると視聴ページへ遷移します。

---

## アクセス制御

アクセス制御はサーバーサイドで実施します。ページレンダリング時に認証・ロール判定を行い、条件に応じてリダイレクトします。

| 条件 | 動作 |
|------|------|
| セッションなし（未認証） | `/` へ `redirect()` |
| `admin` ロールなし かつ `premiumuser` ロールなし | `/dashboard` へ `redirect()` |
| `admin` または `premiumuser` ロールあり | 画面を表示 |

ロール判定は `lib/authz.ts` の `hasTopAdminRole(userId)` / `hasPremiumRole(userId)` を `Promise.all` で並列実行します。

---

## 画面レイアウト

### デスクトップ（xl 以上）

```
┌────────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌──────────────────────────────────────────────┐ │
│ │ ← 戻る       │ │ [≡]  ShowTube                   v3.0.0-β   │ │
│ │ ▶ ShowTube   │ └──────────────────────────────────────────────┘ │
│ │ ────────     │ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│ │ ジャンル     │ │[サムネイル] │ │[サムネイル] │ │[サムネイル] │   │
│ │ Genre1      │ │ ルーム名   │ │ ルーム名   │ │ ルーム名   │   │
│ │ Genre2      │ │ # 123456   │ │ # 123456   │ │ # 123456   │   │
│ │ Genre3      │ └────────────┘ └────────────┘ └────────────┘   │
│ │             │ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│ │ ────────    │ │ ...        │ │ ...        │ │ ...        │   │
│ │[ログアウト]  │ └────────────┘ └────────────┘ └────────────┘   │
│ └──────────────┘                                                   │
└────────────────────────────────────────────────────────────────────┘
```

### モバイル（xl 未満）

```
┌────────────────────────────────────────────┐
│ [≡]  ShowTube                  v3.0.0-β   │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ [サムネイル]                          │   │
│ │ ルーム名                              │   │
│ │ # 123456                             │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ ...                                  │   │
│ └──────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

### エラー・空状態

```
┌───────────────────────────────────────────────┐
│  データの取得に失敗しました。                  │  ← hasError = true
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│  ライブ中のルームはありません。                │  ← items.length === 0
└───────────────────────────────────────────────┘
```

---

## レスポンシブ対応

| ブレークポイント | カードグリッド列数 |
|---|---|
| デフォルト（モバイル） | 1列 |
| sm（640px 以上） | 2列 |
| lg（1024px 以上） | 3列 |
| 2xl（1536px 以上） | 4列 |

サイドバーはデスクトップ（xl = 1280px 以上）で常設表示、モバイルではオフキャンバス方式。

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
                      └─ searchParams.genre を取得 → parseInt で selectedGenreId に変換
                           │  （undefined の場合は null、数値でない場合は NaN）
                           └─ getOnlives() （Promise.allSettled）
                                ├─ 失敗 → onlives=null, hasError=true
                                └─ 成功 → ジャンルフィルタリング
                                     ├─ selectedGenreId が有効な整数 → 該当ジャンルの lives のみ
                                     └─ selectedGenreId が null または NaN → 全ジャンル flatten + roomId で重複除去
                                          └─ ShowTubeShell + ShowTubeLivePage レンダリング
```

---

## SHOWROOM API 連携

| 関数 | エンドポイント | キャッシュ | 用途 |
|------|-------------|---------|------|
| `getOnlives()` | `GET https://www.showroom-live.com/api/live/onlives` | `no-store` | 配信中ルーム・ジャンル一覧取得 |

---

## コンポーネント構成

### ShowTubeShell

- **ファイル**: [components/showtube/showtube-shell.tsx](../../components/showtube/showtube-shell.tsx)
- **種別**: Client Component (`"use client"`)

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `children` | `ReactNode`（省略可） | メインコンテンツ |
| `genres` | `ShowTubeGenre[]` | サイドバーに表示するジャンル一覧 |
| `selectedGenreId` | `number \| null` | 現在選択中のジャンルID |

**サイドバー切り替えロジック**:

- ハンバーガーボタン押下時、`window.matchMedia("(min-width: 1280px)")` の結果で分岐
- `true`（デスクトップ）: `desktopSidebarOpen` をトグル
- `false`（モバイル）: `mobileSidebarOpen` をトグル

**デスクトップサイドバー（`DesktopSidebar`）**:

- `xl:flex` で表示（モバイルは `hidden`）
- 幅: `w-72`（固定）
- `desktopSidebarOpen = false` の場合は `null` を返す（非表示）

**モバイルサイドバー（`MobileSidebar`）**:

- `xl:hidden` で表示（デスクトップは非表示）
- オーバーレイ: `fixed inset-0 z-40 bg-slate-900/40`
- サイドバー本体: `fixed left-0 top-0 z-50 w-72`、スライドアニメーション（`translate-x-0` / `-translate-x-full`）
- オーバーレイクリックまたは X ボタンで閉じる

**サイドバーのナビゲーション項目**:

| 項目 | リンク先 | 表示条件 |
|------|---------|---------|
| ← 戻る | `/dashboard` | 常時 |
| ▶ ShowTube | `/showtube` | 常時 |
| ジャンル名（各ジャンル） | `/showtube?genre={genreId}` | `genres.length > 0` |

**フッター**:

- 「Create by よーいちろー」テキスト（`https://x.com/yoichiro_sub` へのリンク）
- ログアウトボタン（`signOut({ redirectTo: "/" })`）

---

### ShowTubeLivePage

- **ファイル**: [components/showtube/showtube-live-page.tsx](../../components/showtube/showtube-live-page.tsx)
- **種別**: Client Component (`"use client"`)

**Props**:

| prop | 型 | 説明 |
|------|----|------|
| `items` | `OnliveItem[]` | 表示するライブ一覧 |
| `hasError` | `boolean` | API 取得エラーフラグ |

**表示状態**:

| 状態 | 表示内容 |
|------|---------|
| `hasError = true` | 「データの取得に失敗しました。」 |
| `items.length === 0` | 「ライブ中のルームはありません。」 |
| 通常 | グリッドレイアウトでカード一覧 |

**OnliveCard の表示要素**:

| 要素 | 内容 |
|------|------|
| サムネイル | `item.image`（`<img>` タグ使用、`aspect-video`） |
| ルーム名 | `item.mainName`（truncate） |
| ルームID | `# {item.roomId}` |
| リンク先 | `/showtube/watch?room_id={item.roomId}` |

---

## 型定義

### ShowTubeGenre

```typescript
// components/showtube/showtube-shell.tsx
type ShowTubeGenre = {
  genreId: number;
  genreName: string;
};
```

### OnliveItem（抜粋）

`lib/showroom/onlives.ts` で定義。ライブ一覧ページで使用するフィールドは以下の通り。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `roomId` | `number` | ルームID |
| `mainName` | `string` | ルーム名 |
| `image` | `string` | サムネイル画像URL |

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| [app/showtube/page.tsx](../../app/showtube/page.tsx) | ページエントリーポイント・認証・データ取得 |
| [components/showtube/showtube-shell.tsx](../../components/showtube/showtube-shell.tsx) | レイアウトシェル・サイドバー・ヘッダー |
| [components/showtube/showtube-live-page.tsx](../../components/showtube/showtube-live-page.tsx) | ライブ一覧グリッド・カード |
| [lib/showroom/onlives.ts](../../lib/showroom/onlives.ts) | オンライブ一覧取得・型定義 |
| [lib/showroom/core.ts](../../lib/showroom/core.ts) | SHOWROOM API URL・共通 fetch ユーティリティ |
| [lib/authz.ts](../../lib/authz.ts) | ロール判定（admin / premiumuser） |
| [components/navigation/app-sidebar.tsx](../../components/navigation/app-sidebar.tsx) | ShowTube ナビゲーションリンク |
