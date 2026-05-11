import { writeAuditLog } from "@/lib/audit";
import { authzErrorResponse, requireTopAdminRole } from "@/lib/authz";
import { toJstIsoString } from "@/lib/jst";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const actor = await requireTopAdminRole();
    const expiredBefore = new Date();
    const expiredBeforeIso = toJstIsoString(expiredBefore);

    const deleted = await prisma.$transaction(async (tx) => {
      const result = await tx.session.deleteMany({
        where: {
          expires: {
            lt: expiredBefore,
          },
        },
      });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: "session.cleanup_expired",
          resource: "session",
          detail: {
            deletedCount: result.count,
            expiredBefore: expiredBeforeIso,
          },
        },
        tx,
      );

      return result;
    });

    logger.info("Expired sessions cleaned up", {
      actorId: actor.id,
      deletedCount: deleted.count,
      expiredBefore: expiredBeforeIso,
    });

    return Response.json({
      deletedCount: deleted.count,
      expiredBefore: expiredBeforeIso,
    });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) {
      return authzResponse;
    }

    logger.error("Expired session cleanup failed", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
