-- Migration: replace Prisma @updatedAt (UTC) with a DB-level trigger that
-- writes JST wall-clock time, consistent with the created_at default.

CREATE OR REPLACE FUNCTION update_updated_at_jst()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_jst();

CREATE TRIGGER trg_user_registered_rooms_updated_at
  BEFORE UPDATE ON "user_registered_rooms"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_jst();

CREATE TRIGGER trg_invitation_codes_updated_at
  BEFORE UPDATE ON "invitation_codes"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_jst();

CREATE TRIGGER trg_user_blocks_updated_at
  BEFORE UPDATE ON "user_blocks"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_jst();

CREATE TRIGGER trg_dashboard_notices_updated_at
  BEFORE UPDATE ON "dashboard_notices"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_jst();

CREATE TRIGGER trg_maintenance_windows_updated_at
  BEFORE UPDATE ON "maintenance_windows"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_jst();

CREATE TRIGGER trg_onlive_logs_updated_at
  BEFORE UPDATE ON "onlive_logs"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_jst();

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON "roles"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_jst();

CREATE TRIGGER trg_permissions_updated_at
  BEFORE UPDATE ON "permissions"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_jst();
