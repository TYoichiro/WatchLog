import { writeAuditLog } from "@/lib/audit";
import { authzErrorResponse, hasTopAdminRole, requireTopAdminRole } from "@/lib/authz";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

type SetBanBody = {
  banned: boolean;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireTopAdminRole();
    const { userId } = await context.params;
    const body = await readBody(request);

    if (!body) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true },
    });

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (actor.id === userId) {
      return Response.json({ error: "Cannot ban yourself" }, { status: 400 });
    }

    if (await hasTopAdminRole(userId)) {
      return Response.json({ error: "Cannot ban an admin" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          isBanned: body.banned,
          ...(body.banned ? {} : { inviteCodeFailureCount: 0 }),
        },
      });

      if (body.banned) {
        await tx.session.deleteMany({ where: { userId } });
      }

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: body.banned ? "user.ban" : "user.unban",
          resource: "user",
          resourceId: userId,
          detail: { banned: body.banned },
        },
        tx,
      );
    });

    logger.info("User ban status updated", { actorId: actor.id, userId, banned: body.banned });
    return Response.json({ banned: body.banned });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) {
      return authzResponse;
    }

    logger.error("User ban update failed", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function readBody(request: Request): Promise<SetBanBody | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }
    const banned = (body as Record<string, unknown>).banned;
    if (typeof banned !== "boolean") {
      return null;
    }
    return { banned };
  } catch {
    return null;
  }
}
