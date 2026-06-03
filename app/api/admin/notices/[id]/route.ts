import type { DashboardNoticeTarget } from "@/app/generated/prisma/enums";

import { writeAuditLog } from "@/lib/audit";
import { authzErrorResponse, requireTopAdminRole } from "@/lib/authz";
import { parseJstWallTime } from "@/lib/jst";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { noticeSelect, serializeNotice, VALID_TARGETS } from "../route";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTopAdminRole();
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

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

    if (
      title !== undefined &&
      (typeof title !== "string" || title.trim() === "")
    ) {
      return Response.json(
        { error: "title cannot be empty" },
        { status: 400 },
      );
    }
    if (
      content !== undefined &&
      (typeof content !== "string" || content.trim() === "")
    ) {
      return Response.json(
        { error: "content cannot be empty" },
        { status: 400 },
      );
    }
    if (
      displayTarget !== undefined &&
      !VALID_TARGETS.includes(displayTarget as DashboardNoticeTarget)
    ) {
      return Response.json(
        { error: "displayTarget is invalid" },
        { status: 400 },
      );
    }

    let publishedAt: Date | undefined;
    if (publishedAtRaw !== undefined) {
      const parsed = parseJstWallTime(publishedAtRaw);
      if (!parsed) {
        return Response.json(
          { error: "publishedAt is invalid" },
          { status: 400 },
        );
      }
      publishedAt = parsed;
    }

    let expiresAt: Date | null | undefined;
    if (expiresAtRaw !== undefined) {
      if (expiresAtRaw === null || expiresAtRaw === "") {
        expiresAt = null;
      } else {
        const parsed = parseJstWallTime(expiresAtRaw);
        if (!parsed) {
          return Response.json(
            { error: "expiresAt is invalid" },
            { status: 400 },
          );
        }
        expiresAt = parsed;
      }
    }

    const existing = await prisma.dashboardNotice.findUnique({
      where: { id },
      select: { id: true, publishedAt: true, expiresAt: true },
    });

    if (!existing) {
      return Response.json({ error: "Not Found" }, { status: 404 });
    }

    const effectivePublishedAt = publishedAt ?? existing.publishedAt;
    const effectiveExpiresAt =
      expiresAt !== undefined ? expiresAt : existing.expiresAt;
    if (
      effectiveExpiresAt !== null &&
      effectiveExpiresAt <= effectivePublishedAt
    ) {
      return Response.json(
        { error: "expiresAt must be after publishedAt" },
        { status: 400 },
      );
    }

    type UpdateData = {
      title?: string;
      content?: string;
      displayTarget?: DashboardNoticeTarget;
      publishedAt?: Date;
      expiresAt?: Date | null;
      linkUrl?: string | null;
    };
    const updateData: UpdateData = {};

    if (title !== undefined) updateData.title = (title as string).trim();
    if (content !== undefined) updateData.content = (content as string).trim();
    if (displayTarget !== undefined)
      updateData.displayTarget = displayTarget as DashboardNoticeTarget;
    if (publishedAt !== undefined) updateData.publishedAt = publishedAt;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
    if (linkUrl !== undefined) {
      updateData.linkUrl =
        typeof linkUrl === "string" && linkUrl.trim() !== ""
          ? linkUrl.trim()
          : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const notice = await tx.dashboardNotice.update({
        where: { id },
        data: updateData,
        select: noticeSelect,
      });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: "dashboard_notice.update",
          resource: "dashboard_notice",
          resourceId: String(id),
          detail: JSON.parse(JSON.stringify(updateData)),
        },
        tx,
      );

      return notice;
    });

    logger.info("ダッシュボードお知らせを更新しました", {
      actorId: actor.id,
      noticeId: id,
    });

    return Response.json({ notice: serializeNotice(updated) });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;

    logger.error("管理者: お知らせの更新に失敗しました", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTopAdminRole();
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await prisma.dashboardNotice.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Not Found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.dashboardNotice.delete({ where: { id } });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: "dashboard_notice.delete",
          resource: "dashboard_notice",
          resourceId: String(id),
          detail: {},
        },
        tx,
      );
    });

    logger.info("ダッシュボードお知らせを削除しました", {
      actorId: actor.id,
      noticeId: id,
    });

    return Response.json({ id });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;

    logger.error("管理者: お知らせの削除に失敗しました", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
