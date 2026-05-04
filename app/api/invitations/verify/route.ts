import { NextRequest } from "next/server";

import { auth } from "@/auth";
import { isInvitationCodeAvailable } from "@/lib/invitations";
import type { VerifyInvitationCodeRequestBody } from "@/types/api/invitations";

export const dynamic = "force-dynamic";

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: VerifyInvitationCodeRequestBody;

  try {
    body = (await request.json()) as VerifyInvitationCodeRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return Response.json({
    valid: await isInvitationCodeAvailable(body.inviteCode),
  });
}
