import type { DashboardNoticeTarget } from "@/app/generated/prisma/enums";

import { noticeSelect, serializeNotice, VALID_TARGETS } from "@/lib/admin-notices";
import { writeAuditLog } from "@/lib/audit";
import { authzErrorResponse, requireTopAdminRole } from "@/lib/authz";
import { parseJstWallTime, toJstWallTimeIsoString } from "@/lib/jst";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireTopAdminRole();

    const notices = await prisma.dashboardNotice.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: noticeSelect,
    });

    return Response.json({ notices: notices.map(serializeNotice) });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;

    logger.error("管理者: お知らせ一覧の取得に失敗しました", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireTopAdminRole();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      title,
      content,
      displayTarget,
      publishedAt: publishedAtRaw,
      expiresAt: expiresAtRaw,
      linkUrl,
    } = body as Record<string, unknown>;

    if (typeof title !== "string" || title.trim() === "") {
      return Response.json({ error: "title is required" }, { status: 400 });
    }
    if (typeof content !== "string" || content.trim() === "") {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const resolvedTarget = (
      displayTarget ?? "AUTHENTICATED"
    ) as DashboardNoticeTarget;
    if (!VALID_TARGETS.includes(resolvedTarget)) {
      return Response.json(
        { error: "displayTarget is invalid" },
        { status: 400 },
      );
    }

    if (typeof publishedAtRaw !== "string") {
      return Response.json(
        { error: "publishedAt is required" },
        { status: 400 },
      );
    }
    const publishedAt = parseJstWallTime(publishedAtRaw);
    if (!publishedAt) {
      return Response.json(
        { error: "publishedAt is invalid" },
        { status: 400 },
      );
    }

    let expiresAt: Date | null = null;
    if (
      expiresAtRaw !== undefined &&
      expiresAtRaw !== null &&
      expiresAtRaw !== ""
    ) {
      const parsed = parseJstWallTime(expiresAtRaw);
      if (!parsed) {
        return Response.json(
          { error: "expiresAt is invalid" },
          { status: 400 },
        );
      }
      if (parsed <= publishedAt) {
        return Response.json(
          { error: "expiresAt must be after publishedAt" },
          { status: 400 },
        );
      }
      expiresAt = parsed;
    }

    const trimmedLinkUrl =
      typeof linkUrl === "string" && linkUrl.trim() !== ""
        ? linkUrl.trim()
        : null;

    const created = await prisma.$transaction(async (tx) => {
      const notice = await tx.dashboardNotice.create({
        data: {
          title: title.trim(),
          content: content.trim(),
          displayTarget: resolvedTarget,
          publishedAt,
          expiresAt,
          linkUrl: trimmedLinkUrl,
        },
        select: noticeSelect,
      });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: "dashboard_notice.create",
          resource: "dashboard_notice",
          resourceId: String(notice.id),
          detail: {
            title: notice.title,
            displayTarget: notice.displayTarget,
            publishedAt: toJstWallTimeIsoString(notice.publishedAt),
          },
        },
        tx,
      );

      return notice;
    });

    logger.info("ダッシュボードお知らせを作成しました", {
      actorId: actor.id,
      noticeId: created.id,
    });

    return Response.json({ notice: serializeNotice(created) }, { status: 201 });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;

    logger.error("管理者: お知らせの作成に失敗しました", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
