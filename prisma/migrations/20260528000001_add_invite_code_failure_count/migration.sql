-- AlterTable
ALTER TABLE "users" ADD COLUMN "invite_code_failure_count" INTEGER NOT NULL DEFAULT 0;
