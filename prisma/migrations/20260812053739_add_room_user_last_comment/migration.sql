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
ALTER TABLE "onlive_logs" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');

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

-- CreateTable
CREATE TABLE "room_user_last_comments" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "showroom_user_id" TEXT NOT NULL,
    "showroom_user_name" TEXT NOT NULL,
    "last_comment_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),

    CONSTRAINT "room_user_last_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_user_last_comments_room_id_last_comment_at_idx" ON "room_user_last_comments"("room_id", "last_comment_at");

-- CreateIndex
CREATE UNIQUE INDEX "room_user_last_comments_room_id_showroom_user_id_key" ON "room_user_last_comments"("room_id", "showroom_user_id");
