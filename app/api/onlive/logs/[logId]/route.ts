import { authzErrorResponse, getUserRoles, requireUser } from "@/lib/authz";
import { writeAuditLog } from "@/lib/audit";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { logger } from "@/lib/logger";
import { deleteUserOnliveLog, getAnyOnliveLog, getUserOnliveLog, updateOnliveLogTitle } from "@/lib/onlive-log";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ logId: string }> }
) {
  const { logId } = await params;

  if (!logId.trim()) {
    return Response.json({ error: "logId is required" }, { status: 400 });
  }

  try {
    const user = await requireUser();
    const { isAdmin } = await getUserRoles(user.id);
    const log = isAdmin
      ? await getAnyOnliveLog(logId)
      : await getUserOnliveLog(user.id, logId);

    if (!log) {
      return Response.json({ error: "Log not found" }, { status: 404 });
    }

    return Response.json({
      capturedAt: toJstWallTimeIsoString(log.capturedAt),
      liveId: log.liveId,
      log: log.log,
      roomId: log.roomId,
    });
  } catch (error) {
    const response = authzErrorResponse(error);
    if (response) return response;
    logger.error("オンライブログの取得に失敗しました", { logId, error: String(error) });
    return Response.json({ error: "Failed to fetch log" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ logId: string }> }
) {
  const { logId } = await params;

  if (!logId.trim()) {
    return Response.json({ error: "logId is required" }, { status: 400 });
  }

  try {
    const user = await requireUser();
    const { isAdmin, isPremium } = await getUserRoles(user.id);

    if (!isAdmin && !isPremium) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { title?: unknown };
    const title =
      typeof body.title === "string" && body.title.trim().length > 0
        ? body.title.trim()
        : null;

    const updated = await updateOnliveLogTitle(user.id, logId, title, isAdmin);

    if (!updated) {
      return Response.json({ error: "Log not found" }, { status: 404 });
    }

    logger.info("オンライブログのタイトルを更新しました", { userId: user.id, logId, title });
    return Response.json({ ok: true, title });
  } catch (error) {
    const response = authzErrorResponse(error);
    if (response) return response;
    logger.error("オンライブログのタイトル更新に失敗しました", { logId, error: String(error) });
    return Response.json({ error: "Failed to update log title" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ logId: string }> }
) {
  const { logId } = await params;

  if (!logId.trim()) {
    return Response.json({ error: "logId is required" }, { status: 400 });
  }

  try {
    const user = await requireUser();
    const { isAdmin } = await getUserRoles(user.id);
    const deleted = await deleteUserOnliveLog(user.id, logId, isAdmin);

    if (!deleted) {
      return Response.json({ error: "Log not found" }, { status: 404 });
    }

    logger.info("オンライブログを削除しました", { userId: user.id, logId, isAdmin });
    if (isAdmin) {
      try {
        await writeAuditLog({
          actorUserId: user.id,
          action: "onlive_log.delete",
          resource: "onlive_log",
          resourceId: logId,
          detail: { isAdmin: true },
        });
      } catch (auditError) {
        logger.error("監査ログの書き込みに失敗しました", { logId, error: String(auditError) });
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    const response = authzErrorResponse(error);

    if (response) {
      return response;
    }

    logger.error("オンライブログの削除に失敗しました", { logId, error: String(error) });
    return Response.json({ error: "Failed to delete log" }, { status: 500 });
  }
}
