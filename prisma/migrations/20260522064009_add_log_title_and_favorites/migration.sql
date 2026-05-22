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
ALTER TABLE "onlive_logs" ADD COLUMN     "title" TEXT,
ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),
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
CREATE TABLE "onlive_log_favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "log_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'),

    CONSTRAINT "onlive_log_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onlive_log_favorites_user_id_created_at_idx" ON "onlive_log_favorites"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "onlive_log_favorites_user_id_log_id_key" ON "onlive_log_favorites"("user_id", "log_id");

-- AddForeignKey
ALTER TABLE "onlive_log_favorites" ADD CONSTRAINT "onlive_log_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onlive_log_favorites" ADD CONSTRAINT "onlive_log_favorites_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "onlive_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
