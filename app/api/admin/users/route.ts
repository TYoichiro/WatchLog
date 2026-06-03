// app/api/admin/users/route.ts
import { authzErrorResponse, requirePermission } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("user.read");

    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isBanned: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            assignedAt: true,
            role: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    return Response.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        isBanned: user.isBanned,
        createdAt: toJstWallTimeIsoString(user.createdAt),
        updatedAt: toJstWallTimeIsoString(user.updatedAt),
        roles: user.userRoles.map((userRole) => ({
          id: userRole.role.id,
          name: userRole.role.name,
          description: userRole.role.description,
          assignedAt: toJstWallTimeIsoString(userRole.assignedAt),
        })),
      })),
    });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) {
      return authzResponse;
    }

    logger.error("管理者: ユーザー一覧の取得に失敗しました", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
