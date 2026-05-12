import { authzErrorResponse, hasTopAdminRole, requireUser } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { deleteUserOnliveLog, getAnyOnliveLog, getUserOnliveLog } from "@/lib/onlive-log";

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
    const isAdmin = await hasTopAdminRole(user.id);
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
    return Response.json({ error: "Failed to fetch log" }, { status: 500 });
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
    const deleted = await deleteUserOnliveLog(user.id, logId);

    if (!deleted) {
      return Response.json({ error: "Log not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const response = authzErrorResponse(error);

    if (response) {
      return response;
    }

    return Response.json({ error: "Failed to delete log" }, { status: 500 });
  }
}
