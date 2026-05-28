import { NextRequest } from "next/server";

import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { isInvitationCodeAvailable } from "@/lib/invitations";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { VerifyInvitationCodeRequestBody } from "@/types/api/invitations";

export const dynamic = "force-dynamic";

const INVITE_CODE_BAN_THRESHOLD = 3;

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

  const isValid = await isInvitationCodeAvailable(body.inviteCode);

  if (isValid) {
    await prisma.user.update({
      where: { id: userId },
      data: { inviteCodeFailureCount: 0 },
    });
    return Response.json({ valid: true });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { inviteCodeFailureCount: { increment: 1 } },
    select: { inviteCodeFailureCount: true },
  });

  const failureCount = updated.inviteCodeFailureCount;

  if (failureCount >= INVITE_CODE_BAN_THRESHOLD) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isBanned: true },
      });
      await tx.session.deleteMany({ where: { userId } });
      await writeAuditLog(
        {
          actorUserId: null,
          action: "user.ban",
          resource: "user",
          resourceId: userId,
          detail: { reason: "invite_code_failure", failureCount },
        },
        tx
      );
    });

    logger.warn("User auto-banned due to invite code failures", {
      userId,
      failureCount,
    });

    return Response.json({ valid: false, banned: true });
  }

  return Response.json({
    valid: false,
    remainingAttempts: INVITE_CODE_BAN_THRESHOLD - failureCount,
  });
}
