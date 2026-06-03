import { authzErrorResponse, requireUser } from "@/lib/authz";
import { logger } from "@/lib/logger";
import { deleteUserBlock } from "@/lib/user-blocks";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ blockId: string }> }
) {
  const { blockId } = await params;

  if (!blockId.trim()) {
    return Response.json({ error: "blockId is required" }, { status: 400 });
  }

  try {
    const user = await requireUser();
    const deleted = await deleteUserBlock(user.id, blockId);

    if (!deleted) {
      logger.warn("ブロック削除: 見つからないかユーザーが所有していません", { userId: user.id, blockId });
      return Response.json({ error: "Block not found" }, { status: 404 });
    }

    logger.info("ブロックを削除しました", { userId: user.id, blockId });
    return Response.json({ ok: true });
  } catch (error) {
    const response = authzErrorResponse(error);

    if (response) {
      return response;
    }

    logger.error("ブロックの削除に失敗しました", { blockId, error: String(error) });
    return Response.json({ error: "Failed to delete block" }, { status: 500 });
  }
}
