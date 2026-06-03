import { writeAuditLog } from "@/lib/audit";
import { PREMIUM_ROLE_NAME, TOP_ADMIN_ROLE_NAME, authzErrorResponse, requirePermission } from "@/lib/authz";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

type SetRoleBody = {
  role: "premiumuser" | "general";
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requirePermission("role.assign");
    const { userId } = await context.params;
    const body = await readBody(request);

    if (!body) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (body.role === "premiumuser") {
      await setPremiumRole(userId, actor.id);
      logger.info("ロールをプレミアムに設定しました", { actorId: actor.id, userId });
      return Response.json({ role: "premiumuser" });
    }

    await removePremiumRole(userId, actor.id);
    logger.info("ロールを一般に設定しました", { actorId: actor.id, userId });
    return Response.json({ role: "general" });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) {
      return authzResponse;
    }

    logger.error("ロールの更新に失敗しました", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function setPremiumRole(userId: string, actorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const premiumRole = await tx.role.findUnique({
      where: { name: PREMIUM_ROLE_NAME },
      select: { id: true },
    });

    if (!premiumRole) {
      throw new Error(`Role not found: ${PREMIUM_ROLE_NAME}`);
    }

    await tx.userRole.upsert({
      where: { userId_roleId: { userId, roleId: premiumRole.id } },
      update: { assignedByUserId: actorId },
      create: { userId, roleId: premiumRole.id, assignedByUserId: actorId },
      select: { id: true },
    });

    await writeAuditLog(
      {
        actorUserId: actorId,
        action: "role.assign",
        resource: "user",
        resourceId: userId,
        detail: { roleName: PREMIUM_ROLE_NAME },
      },
      tx,
    );
  });
}

async function removePremiumRole(userId: string, actorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const premiumRole = await tx.role.findUnique({
      where: { name: PREMIUM_ROLE_NAME },
      select: { id: true },
    });

    if (!premiumRole) {
      throw new Error(`Role not found: ${PREMIUM_ROLE_NAME}`);
    }

    const deleted = await tx.userRole.deleteMany({
      where: {
        userId,
        roleId: premiumRole.id,
        role: { name: { not: TOP_ADMIN_ROLE_NAME } },
      },
    });

    if (deleted.count > 0) {
      await writeAuditLog(
        {
          actorUserId: actorId,
          action: "role.remove",
          resource: "user",
          resourceId: userId,
          detail: { roleName: PREMIUM_ROLE_NAME },
        },
        tx,
      );
    }
  });
}

async function readBody(request: Request): Promise<SetRoleBody | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }
    const role = (body as Record<string, unknown>).role;
    if (role !== "premiumuser" && role !== "general") {
      return null;
    }
    return { role };
  } catch {
    return null;
  }
}
