import { authzErrorResponse, requireTopAdminRole } from "@/lib/authz";
import { addInvitationCode } from "@/lib/invitations";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireTopAdminRole();
    const invitation = await addInvitationCode(user.id);
    logger.info("招待コードが作成されました", { actorId: user.id, invitationId: invitation.id });
    return Response.json(invitation, { status: 201 });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;
    logger.error("招待コードの作成に失敗しました", { error: String(error) });
    throw error;
  }
}
