// app/api/admin/audit-logs/route.ts
import { authzErrorResponse, requirePermission } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePermission("audit.read");

    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const auditLogs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        actorUserId: true,
        action: true,
        resource: true,
        resourceId: true,
        detail: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return Response.json({
      auditLogs: auditLogs.map((auditLog) => ({
        ...auditLog,
        createdAt: toJstWallTimeIsoString(auditLog.createdAt),
      })),
    });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) {
      return authzResponse;
    }

    logger.error("管理者: 監査ログの取得に失敗しました", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function parseLimit(value: string | null): number {
  if (value === null) {
    return 50;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return 50;
  }

  return Math.min(Math.max(parsed, 1), 100);
}
