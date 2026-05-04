import { authzErrorResponse, requireUser } from "@/lib/authz";
import { deleteUserOnliveLog } from "@/lib/onlive-log";

export const dynamic = "force-dynamic";

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
