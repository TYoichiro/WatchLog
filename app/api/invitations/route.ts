import { authzErrorResponse, requireTopAdminRole } from "@/lib/authz";
import { addInvitationCode } from "@/lib/invitations";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireTopAdminRole();
    const invitation = await addInvitationCode(user.id);
    return Response.json(invitation, { status: 201 });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;
    throw error;
  }
}
