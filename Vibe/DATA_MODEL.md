# DATA_MODEL.md — データモデル仕様

> 出典: `prisma/schema.prisma` / `prisma/migrations/**` / `prisma/seed.ts`。実装と `docs/` の突き合わせ済み。
> DB: PostgreSQL（compose 定義は PostgreSQL 16）。Prisma 7、generator は **`prisma-client`（新方式）で出力先 `app/generated/prisma`**。datasource ブロックに `url` は書かず、`prisma.config.ts` の `datasource.url = env("DATABASE_URL")` で供給。ランタイムは `@prisma/adapter-pg`（driver adapter）を使用。

## 0. 時刻の扱い（最重要の癖）

- 全テーブルの `created_at` / `updated_at` は `TIMESTAMP(3)`（タイムゾーンなし）に **JST の壁時計時刻** を格納する。
  - デフォルト値: `DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')`（Prisma では `@default(dbgenerated(...))`）
  - `updated_at` は Prisma の `@updatedAt` を使わず、**DB トリガー** `update_updated_at_jst()`（migration `20260522000001`）が UPDATE 時に JST を書き込む。トリガー対象: users, user_registered_rooms, invitation_codes, user_blocks, dashboard_notices, maintenance_windows, onlive_logs, roles, permissions
- アプリ側も JST 壁時計の Date（UTC フィールドに JST 値を持つ Date）で比較・保存する（`lib/jst.ts` の `toJstWallTimeDate` / `parseJstWallTime` / `toJstWallTimeIsoString`）。
- PostgreSQL セッションの timezone も接続オプション `-c timezone=Asia/Tokyo` で固定（`lib/server-timezone.ts` → `lib/prisma.ts`）。
- `process.env.TZ = "Asia/Tokyo"` を `next.config.ts` / `prisma.config.ts` / `lib/server-timezone.ts` が強制。

## 1. ER 概要

```
users 1─1 user_registered_rooms ─0..1 invitation_codes(消費コード)
users 1─* invitation_codes (inviter / usedBy の2系統)
users 1─* user_blocks（SHOWROOM ユーザー ID をブロック。相手はアプリ内ユーザーではない）
users 1─* accounts / sessions            （NextAuth）
users *─* roles (user_roles) ─ roles *─* permissions (role_permissions)
users 1─* audit_logs (actor)
users *─* onlive_logs (onlive_log_favorites)
dashboard_notices / maintenance_windows / verification_tokens は独立テーブル
```

## 2. テーブル定義

### users
| カラム | 型 | 制約 |
| --- | --- | --- |
| id | TEXT (cuid) | PK |
| name / email / email_verified / image | TEXT / TEXT / TIMESTAMP(3) / TEXT | email UNIQUE, すべて NULL 可 |
| is_banned | BOOLEAN | NOT NULL DEFAULT false |
| invite_code_failure_count | INTEGER | NOT NULL DEFAULT 0 |
| created_at / updated_at | TIMESTAMP(3) | JST デフォルト＋トリガー |

### user_registered_rooms（ユーザーごとに 1 ルーム）
| カラム | 型 | 制約 |
| --- | --- | --- |
| id | TEXT (cuid) | PK |
| user_id | TEXT | UNIQUE, FK→users ON DELETE CASCADE |
| room_id | TEXT | NOT NULL, INDEX |
| room_url | TEXT | NOT NULL（SHOWROOM の room_url_key） |
| room_name | TEXT | NULL 可 |
| image_url | TEXT | NULL 可 |
| invite_code_id | TEXT | UNIQUE, FK→invitation_codes ON DELETE SET NULL |
| created_at / updated_at | TIMESTAMP(3) | 同上 |

※ `room_id` に UNIQUE 制約は**ない**。「他ユーザーとの重複禁止」はアプリロジック（`getRegisteredRoomOwner`）で担保し、admin は同一ルームの重複登録が可能。

### invitation_codes
| カラム | 型 | 制約 |
| --- | --- | --- |
| id | TEXT (cuid) | PK |
| code | VARCHAR(10) | UNIQUE。`A-Z0-9` の 10 文字（`crypto.randomInt` 生成） |
| inviter_user_id | TEXT | FK→users SET NULL, INDEX(inviter,created_at) |
| used_by_user_id | TEXT | FK→users SET NULL, INDEX |
| used_at | TIMESTAMP(3) | NULL=未使用 |
| is_deleted | BOOLEAN | DEFAULT false。**消費時に true にする**（論理削除＝使用済み） |
| created_at / updated_at | TIMESTAMP(3) | INDEX(is_deleted, used_at) |

有効なコードの条件: `is_deleted=false AND used_at IS NULL AND used_by_user_id IS NULL`。

### user_blocks
| カラム | 型 | 制約 |
| --- | --- | --- |
| id | TEXT (cuid) | PK |
| blocker_user_id | TEXT | FK→users CASCADE |
| blocked_showroom_user_id | TEXT | SHOWROOM のユーザー ID（数値文字列） |
| blocked_showroom_user_name | TEXT | NOT NULL |
| created_at / updated_at | TIMESTAMP(3) | |
| UNIQUE(blocker_user_id, blocked_showroom_user_id) / INDEX(blocked_showroom_user_id) / INDEX(blocker_user_id, created_at) | | |

### dashboard_notices
| カラム | 型 | 制約 |
| --- | --- | --- |
| id | SERIAL | PK（数値 ID。他テーブルは cuid） |
| title | TEXT | NOT NULL |
| content | TEXT | NOT NULL |
| display_target | ENUM `DashboardNoticeTarget` | `AUTHENTICATED` \| `LOGIN` \| `ALL`、DEFAULT `AUTHENTICATED` |
| published_at | TIMESTAMP(3) | NOT NULL（JST 壁時計） |
| expires_at | TIMESTAMP(3) | NULL=無期限 |
| link_url | TEXT | NULL 可（表示時に http/https のみ許可） |
| created_at / updated_at | TIMESTAMP(3) | INDEX(display_target, published_at) / (published_at) / (expires_at) |

### maintenance_windows
| カラム | 型 | 制約 |
| --- | --- | --- |
| id | TEXT (cuid) | PK |
| title | TEXT | DEFAULT 'システムメンテナンス' |
| message | TEXT | NULL 可 |
| starts_at / ends_at | TIMESTAMP(3) | NOT NULL（JST 壁時計、ends_at > starts_at をアプリで検証） |
| is_enabled | BOOLEAN | DEFAULT true |
| created_at / updated_at | TIMESTAMP(3) | INDEX(is_enabled, starts_at, ends_at) |

アクティブ判定: `is_enabled AND starts_at <= now(JST) AND ends_at > now(JST)`（`lib/maintenance.ts`）。

### onlive_logs（配信ログ本体）
| カラム | 型 | 制約 |
| --- | --- | --- |
| id | TEXT (cuid) | PK |
| room_id | TEXT | NOT NULL |
| live_id | TEXT | NOT NULL |
| captured_at | TIMESTAMP(3) | NOT NULL（JST 壁時計） |
| log | JSONB | NOT NULL（ログ本体。構造は [SPEC.md](./SPEC.md) §7.4） |
| title | TEXT | NULL 可（ユーザー編集タイトル） |
| comment_count / gift_count | INTEGER | DEFAULT 0。保存時に `log.comments` / `log.gifts` の配列長から自動計算 |
| is_deleted | BOOLEAN | DEFAULT false（論理削除） |
| created_at / updated_at | TIMESTAMP(3) | |
| UNIQUE(room_id, live_id, captured_at) / INDEX(room_id, live_id) / INDEX(room_id, is_deleted, captured_at) | | |

※ migration 履歴: `live_ranking_count` / `total_ranking_count` は一度追加後に削除済み（最終スキーマには存在しない）。

### onlive_log_favorites
| カラム | 型 | 制約 |
| --- | --- | --- |
| id | TEXT (cuid) | PK |
| user_id | TEXT | FK→users CASCADE |
| log_id | TEXT | FK→onlive_logs CASCADE |
| created_at | TIMESTAMP(3) | |
| UNIQUE(user_id, log_id) / INDEX(user_id, created_at) | | |

### accounts / sessions / verification_tokens（NextAuth 標準）
- accounts: UNIQUE(provider, provider_account_id)、INDEX(user_id)、FK→users CASCADE。token 系カラムは TEXT。
- sessions: session_token UNIQUE、expires TIMESTAMP(3)、INDEX(user_id)、FK→users CASCADE。**DB セッション戦略**（maxAge 180 日）。
- verification_tokens: UNIQUE(identifier, token)。PK なし。

### roles / permissions / user_roles / role_permissions
- roles: name UNIQUE（`admin` / `user` / `premiumuser` の 3 種を seed）
- permissions: action UNIQUE
- user_roles: UNIQUE(user_id, role_id)、assigned_by_user_id FK→users SET NULL、assigned_at JST デフォルト
- role_permissions: UNIQUE(role_id, permission_id)

### audit_logs
| カラム | 型 | 制約 |
| --- | --- | --- |
| id | TEXT (cuid) | PK |
| actor_user_id | TEXT | FK→users SET NULL（NULL=システム動作。例: 自動 BAN） |
| action | TEXT | INDEX。値の一覧は [SPEC.md](./SPEC.md) §9.4 |
| resource | TEXT | `user` / `user_registered_room` / `dashboard_notice` / `maintenance_window` / `session` / `onlive_log` |
| resource_id | TEXT | NULL 可 |
| detail | JSONB | NOT NULL |
| created_at | TIMESTAMP(3) | INDEX(actor,created_at) / (action) / (resource,resource_id) |

## 3. マイグレーション履歴（再現時は 1 本化してよいが内容は保持）

| ディレクトリ | 内容 |
| --- | --- |
| 20260504061940_init | 全テーブル初期作成（onlive_logs に title/counts なし、users に is_banned なし） |
| 20260522000001_add_updated_at_triggers | `update_updated_at_jst()` 関数＋各テーブルの BEFORE UPDATE トリガー |
| 20260522064009_add_log_title_and_favorites | onlive_logs.title 追加、onlive_log_favorites 作成 |
| 20260523122700_add_is_banned_to_users | users.is_banned 追加 |
| 20260528000001_add_invite_code_failure_count | users.invite_code_failure_count 追加 |
| 20260613115450_add_onlive_log_counts | comment_count/gift_count/live_ranking_count/total_ranking_count 追加＋JSONB からバックフィル |
| 20260614000001_drop_onlive_log_ranking_counts | live_ranking_count/total_ranking_count 削除 |

## 4. シードデータ（prisma/seed.ts）

- ロール: `admin`（System administrator）/ `user`（Default authenticated user）/ `premiumuser`（Premium authenticated user）— upsert
- 権限: `profile.read` / `user.read` / `user.update` / `role.assign` / `audit.read` — upsert
- ロール権限: admin=全 5 権限、user=`profile.read`、premiumuser=`profile.read`
- お知らせ 4 件（同タイトルを deleteMany → createMany で再投入）:
  - AUTHENTICATED: 「β番公開のお知らせ」「設定の招待コードについて」（公開 2026-05-04T12:00 JST）
  - LOGIN: 「ログイン方法について」「WatchLogについて」（公開 2026-05-04T09:00 JST）

## 5. 付随バッチ

- `scripts/backfill-onlive-log-counts.ts`（`npm run batch:backfill-log-counts`）: onlive_logs の comment_count/gift_count を log JSONB から再計算する 1 回限りのバッチ。カーソルページング（200 件/バッチ）。
