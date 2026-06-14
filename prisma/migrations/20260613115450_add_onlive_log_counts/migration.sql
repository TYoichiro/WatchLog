-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "dashboard_notices" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "invitation_codes" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "maintenance_windows" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "onlive_log_favorites" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "onlive_logs" ADD COLUMN     "comment_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gift_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "live_ranking_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_ranking_count" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- Backfill: existing rows get counts extracted from the log JSON
UPDATE "onlive_logs" SET
  "comment_count"       = CASE WHEN jsonb_typeof("log"->'comments')             = 'array' THEN jsonb_array_length("log"->'comments')             ELSE 0 END,
  "gift_count"          = CASE WHEN jsonb_typeof("log"->'gifts')                = 'array' THEN jsonb_array_length("log"->'gifts')                ELSE 0 END,
  "live_ranking_count"  = CASE WHEN jsonb_typeof("log"->'rankings'->'live')     = 'array' THEN jsonb_array_length("log"->'rankings'->'live')     ELSE 0 END,
  "total_ranking_count" = CASE WHEN jsonb_typeof("log"->'rankings'->'total')    = 'array' THEN jsonb_array_length("log"->'rankings'->'total')    ELSE 0 END;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "role_permissions" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "user_blocks" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "user_registered_rooms" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "user_roles" ALTER COLUMN "assigned_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');
