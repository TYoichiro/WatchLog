# ログレスキュー画面 設計書

## 概要

| 項目 | 内容 |
|------|------|
| URL | `/rescue` |
| レンダリング | Server Component（ページ）+ Client Component（`"use client"`） |
| 認証要否 | 必要（未認証時は `/` へリダイレクト） |
| ページタイトル | `ログレスキュー \| WatchLog` |
| ナビゲーション | `AppShell`（`isAdmin` / `isPremium` をページから注入） |

配信監視中にブラウザがクラッシュしたり強制終了した場合など、オンライブ画面がセッション保持用に書き込んだ `localStorage` スナップショット（キープレフィックス `watchlog:onlive:`）が消えずに残ることがあります。ログレスキュー画面はそれらのスナップショットを検出し、`POST /api/onlive/logs` 経由で DB に保存（復旧）する機能を提供します。

---

## アクセス制御

サーバーサイドで認証とロールを確認します。

| 条件 | 動作 |
|------|------|
| 未認証 | `/` へリダイレクト |
| 管理者（`isAdmin`） | ページを表示 |
| プレミアムユーザー（`isPremium`） | ページを表示 |
| 上記以外（一般ユーザー） | `/dashboard` へリダイレクト |

> 復旧先の `POST /api/onlive/logs` はプレミアムユーザー専用エンドポイントです。管理者は管轄外ルームへの復旧を避けるため、自身の登録ルームに一致するスナップショットのみが実際には保存されます（サーバー側バリデーションによる）。

---

## 画面レイアウト

### ログなし（空状態）

```
┌────────────────────────────────────────────────────────┐
│ [サイドバー]  ログレスキュー                             │
│              ┌──────────────────────────────────────┐  │
│              │ ローカルストレージにログが             │  │
│              │ 見つかりませんでした                   │  │
│              └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### ログあり（idle エントリあり）

```
┌──────────────────────────────────────────────────────────┐
│ [サイドバー]  ログレスキュー                               │
│              N件のログが見つかりました                      │
│              ┌───────────┐ ┌──────────────┐              │
│              │  復旧する  │ │ ダウンロード  │              │
│              └───────────┘ └──────────────┘              │
│              ┌────────────────────────────────────────┐  │
│              │ ルームID      123456                    │  │
│              │ ライブID      7654321                   │  │
│              │ コメント数    42件                      │  │
│              │ ギフト数      10件                      │  │
│              │ 最終更新      2026/06/16 12:34:56       │  │
│              └────────────────────────────────────────┘  │
│              ┌────────────────────────────────────────┐  │
│              │ ...（エントリごとにカード）              │  │
│              └────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 全エントリ処理済み（idle なし）

「復旧する」ボタンが非表示になり、「ダウンロード」ボタンが `w-full` で表示されます。

---

## ローカルストレージスキャン

マウント時の `useState` 初期化関数（`scanOnliveSnapshots`）で実行されます。

| 項目 | 値 |
|------|------|
| キープレフィックス | `watchlog:onlive:` |
| バージョン定数 | `ONLIVE_STORAGE_VERSION = 1` |
| スキャン対象 | `localStorage.length` を走査し、プレフィックス一致キーを全件取得 |

**スナップショットの有効条件（`isValidSnapshot`）：**

| フィールド | 条件 |
|-----------|------|
| `version` | `=== 1` |
| `roomId` | `typeof === "number"` |
| `liveId` | `typeof === "string"` かつ `trim().length > 0` |
| `comments` | `Array.isArray` |
| `gifts` | `Array.isArray` |
| `savedAt` | `typeof === "number"`（Unix ミリ秒） |

バリデーションに失敗したエントリ・JSON パースエラーは無視されます（`try/catch` でスキップ）。

---

## 状態管理

### RawSnapshot 型

```typescript
type RawSnapshot = {
  comments: unknown[];
  gifts: unknown[];
  liveId: string;
  metrics: unknown;
  roomId: number;
  savedAt: number; // Unix ms
  version: 1;
};
```

### EntryStatus 型

| `kind` | 意味 |
|--------|------|
| `"idle"` | 未処理（初期状態） |
| `"success"` | 復旧成功 |
| `"error"` | 復旧失敗（`message` フィールドにエラー文字列） |

### state 変数

| 変数 | 型 | 初期値 | 説明 |
|------|----|--------|------|
| `entryStates` | `EntryState[]` | `scanOnliveSnapshots()` の結果を `idle` で初期化 | エントリ一覧と各ステータス |
| `isPending` | `boolean` | `false` | `useTransition` のペンディング状態（復旧中は `true`） |

### 派生値

| 派生値 | 内容 |
|--------|------|
| `hasIdle` | `entryStates.some(s => s.status.kind === "idle")` — 未処理エントリがある場合 `true` |

---

## 復旧フロー（「復旧する」ボタン）

`handleRecoverAll` は `useTransition` を用いて非同期処理します。**idle エントリを逐次処理**します（並行ではなく順番に実行）。

```
「復旧する」ボタンをクリック
  │
  ▼ idle エントリのインデックス一覧を取得
  │
  ▼ useTransition（isPending = true）
  │
  for (index of idleIndices) {
    │
    ▼ recoverEntry(entry)
    POST /api/onlive/logs
      リクエスト:
        {
          capturedAt: snapshot.savedAt の JST ISO 文字列,
          liveId:     snapshot.liveId,
          log: {
            capturedAt:           snapshot.savedAt の JST ISO 文字列,
            comments:             snapshot.comments,
            gifts:                snapshot.gifts,
            liveInfo: {
              endedAt: null, liveId: snapshot.liveId,
              liveStatus: null, startedAt: null, telop: null
            },
            localStorageSnapshot: snapshot（生データ）,
            metrics:              snapshot.metrics,
            rankings:             { live: [] },
            roomProfile:          null,
            roomId:               snapshot.roomId,
            savedAt:              現在時刻の JST ISO 文字列,
            source:               "rescue",
            version:              1
          },
          roomId: String(snapshot.roomId)
        }
      │
      ├─ 成功（response.ok = true）
      │   ├─ setEntryStates で当該エントリを status: { kind: "success" } に更新
      │   └─ localStorage.removeItem(entry.key) でキー削除
      │
      └─ 失敗（response.ok = false）
          ├─ レスポンス JSON の `error` フィールドをメッセージとして取得
          │  （取得できない場合は `エラー (${status})`）
          └─ setEntryStates で当該エントリを status: { kind: "error", message } に更新
             ※ localStorage キーは削除しない
  }
  │
  ▼ isPending = false（useTransition 完了）
```

> 復旧中（`isPending = true`）は「復旧する」・「ダウンロード」ボタンが `disabled` になります。

---

## ダウンロードフロー（「ダウンロード」ボタン）

全エントリに対して一括ダウンロードします。エントリごとに即時ダウンロードをトリガーします。

```
「ダウンロード」ボタンをクリック
  │
  for (state of entryStates) {
    │
    ▼ localStorage.getItem(entry.key) で生 JSON 文字列を取得
    │  （取得できない場合は JSON.stringify(snapshot) をフォールバック）
    │
    ▼ Blob を生成（type: "application/json"）
    ▼ URL.createObjectURL(blob) で一時 URL 生成
    ▼ <a> 要素を動的生成して download / href をセット → a.click()
    ▼ URL.revokeObjectURL(url) で一時 URL を解放
  }
```

**ダウンロードファイル名：**

`watchlog-rescue-{snapshot.roomId}-{snapshot.liveId}.json`

---

## エントリカード表示

各スナップショットが 1 枚のカード（`rounded-xl border`）として表示されます。

| 項目 | 内容 |
|------|------|
| ルームID | `snapshot.roomId`（monospace フォント） |
| ライブID | `snapshot.liveId`（monospace フォント） |
| コメント数 | `snapshot.comments.length`件 |
| ギフト数 | `snapshot.gifts.length`件 |
| 最終更新 | `toJstDisplayString(snapshot.savedAt)`（`YYYY/MM/DD HH:MM:SS` 形式） |

**ステータス表示（カード下部）：**

| ステータス | 表示 |
|-----------|------|
| `idle` | なし |
| `success` | 「保存しました」（emerald、`text-emerald-600`） |
| `error` | 「エラー: {message}」（red、`text-red-600`） |

---

## コンポーネント構成

| ファイル | 種別 | 役割 |
|---------|------|------|
| [app/rescue/page.tsx](../../app/rescue/page.tsx) | Server Component (async) | ページエントリーポイント・認証・ロール確認・メタデータ |
| [components/rescue/rescue-page-loader.tsx](../../components/rescue/rescue-page-loader.tsx) | Client Component | `next/dynamic` による SSR 無効化ラッパー（`ssr: false`） |
| [components/rescue/rescue-page.tsx](../../components/rescue/rescue-page.tsx) | Client Component | ローカルストレージスキャン・復旧・ダウンロード UI |

> `rescue-page-loader.tsx` は `localStorage` に依存するため `ssr: false` で動的インポートします。

---

## 日時ユーティリティ（コンポーネント内ローカル関数）

`lib/jst.ts` は使用せず、コンポーネント内ローカル関数で JST 変換を行っています。

| 関数 | 用途 | 出力例 |
|------|------|--------|
| `toJstWallTimeString(unixMs)` | API リクエスト用 JST ISO 文字列 | `2026-06-16T12:34:56.789+09:00` |
| `toJstDisplayString(unixMs)` | カード上の表示用 JST 文字列 | `2026/06/16 12:34:56` |

---

## API エンドポイント

### POST /api/onlive/logs

- 詳細はオンライブ画面設計書の [POST /api/onlive/logs](onlive.md) 節を参照
- **プレミアムユーザー専用**（管理者も呼び出し可能だが、サーバー側でルームIDバリデーションが行われます）
- `source: "rescue"` フィールドが付与され、通常の配信終了保存と区別可能

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| [app/rescue/page.tsx](../../app/rescue/page.tsx) | ページエントリーポイント・認証・ロール確認 |
| [components/rescue/rescue-page-loader.tsx](../../components/rescue/rescue-page-loader.tsx) | SSR 無効化動的インポートラッパー |
| [components/rescue/rescue-page.tsx](../../components/rescue/rescue-page.tsx) | ログレスキュー UI・復旧・ダウンロード |
| [app/api/onlive/logs/route.ts](../../app/api/onlive/logs/route.ts) | ログ保存 API（復旧先） |
| [lib/authz.ts](../../lib/authz.ts) | `getUserRoles`（isAdmin / isPremium 判定） |
| [docs/screens/onlive.md](onlive.md) | ローカルストレージスナップショットの書き込み元仕様 |
