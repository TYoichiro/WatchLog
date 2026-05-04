import { authzErrorResponse, requireUser } from "@/lib/authz";
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
      return Response.json({ error: "Block not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const response = authzErrorResponse(error);

    if (response) {
      return response;
    }

    return Response.json({ error: "Failed to delete block" }, { status: 500 });
  }
}
