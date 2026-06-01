import { authzErrorResponse, hasTopAdminRole, hasPremiumRole, requireUser } from "@/lib/authz";
import { logger } from "@/lib/logger";
import { toggleOnliveLogFavorite } from "@/lib/onlive-log";

export const dynamic = "force-dynamic";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ logId: string }> }
) {
  const { logId } = await params;

  if (!logId.trim()) {
    return Response.json({ error: "logId is required" }, { status: 400 });
  }

  try {
    const user = await requireUser();
    const [isAdmin, isPremium] = await Promise.all([
      hasTopAdminRole(user.id),
      hasPremiumRole(user.id),
    ]);

    if (!isAdmin && !isPremium) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const isFavorite = await toggleOnliveLogFavorite(user.id, logId, isAdmin);
    return Response.json({ ok: true, isFavorite });
  } catch (error) {
    const response = authzErrorResponse(error);
    if (response) return response;
    logger.error("オンライブログお気に入り切り替え失敗", { logId, error: String(error) });
    return Response.json({ error: "Failed to toggle favorite" }, { status: 500 });
  }
}
