import type { Prisma } from "@/app/generated/prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { authzErrorResponse, requireTopAdminRole } from "@/lib/authz";
import { parseJstWallTime, toJstWallTimeIsoString } from "@/lib/jst";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const maintenanceWindowSelect = {
  id: true,
  title: true,
  message: true,
  startsAt: true,
  endsAt: true,
  isEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializeWindow(w: {
  id: string;
  title: string;
  message: string | null;
  startsAt: Date;
  endsAt: Date;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: w.id,
    title: w.title,
    message: w.message,
    startsAt: toJstWallTimeIsoString(w.startsAt),
    endsAt: toJstWallTimeIsoString(w.endsAt),
    isEnabled: w.isEnabled,
    createdAt: toJstWallTimeIsoString(w.createdAt),
    updatedAt: toJstWallTimeIsoString(w.updatedAt),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTopAdminRole();
    const { id } = await params;

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
      message,
      startsAt: startsAtRaw,
      endsAt: endsAtRaw,
      isEnabled,
    } = body as Record<string, unknown>;

    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
      return Response.json({ error: "title cannot be empty" }, { status: 400 });
    }

    let startsAt: Date | undefined;
    if (startsAtRaw !== undefined) {
      const parsed = parseJstWallTime(startsAtRaw);
      if (!parsed) {
        return Response.json({ error: "startsAt is invalid" }, { status: 400 });
      }
      startsAt = parsed;
    }

    let endsAt: Date | undefined;
    if (endsAtRaw !== undefined) {
      const parsed = parseJstWallTime(endsAtRaw);
      if (!parsed) {
        return Response.json({ error: "endsAt is invalid" }, { status: 400 });
      }
      endsAt = parsed;
    }

    if (startsAt !== undefined && endsAt !== undefined && endsAt <= startsAt) {
      return Response.json(
        { error: "endsAt must be after startsAt" },
        { status: 400 },
      );
    }

    const existing = await prisma.maintenanceWindow.findUnique({
      where: { id },
      select: { id: true, startsAt: true, endsAt: true },
    });

    if (!existing) {
      return Response.json({ error: "Not Found" }, { status: 404 });
    }

    const effectiveStartsAt = startsAt ?? existing.startsAt;
    const effectiveEndsAt = endsAt ?? existing.endsAt;
    if (effectiveEndsAt <= effectiveStartsAt) {
      return Response.json(
        { error: "endsAt must be after startsAt" },
        { status: 400 },
      );
    }

    type UpdateData = {
      title?: string;
      message?: string | null;
      startsAt?: Date;
      endsAt?: Date;
      isEnabled?: boolean;
    };
    const updateData: UpdateData = {};

    if (title !== undefined) updateData.title = (title as string).trim();
    if (message !== undefined) {
      updateData.message =
        typeof message === "string" && message.trim() !== ""
          ? message.trim()
          : null;
    }
    if (startsAt !== undefined) updateData.startsAt = startsAt;
    if (endsAt !== undefined) updateData.endsAt = endsAt;
    if (isEnabled !== undefined) updateData.isEnabled = Boolean(isEnabled);

    const updated = await prisma.$transaction(async (tx) => {
      const window = await tx.maintenanceWindow.update({
        where: { id },
        data: updateData,
        select: maintenanceWindowSelect,
      });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: "maintenance_window.update",
          resource: "maintenance_window",
          resourceId: id,
          detail: updateData as unknown as Prisma.InputJsonValue,
        },
        tx,
      );

      return window;
    });

    logger.info("Maintenance window updated", {
      actorId: actor.id,
      windowId: id,
    });

    return Response.json({ maintenanceWindow: serializeWindow(updated) });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;

    logger.error("Admin maintenance update failed", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireTopAdminRole();
    const { id } = await params;

    const existing = await prisma.maintenanceWindow.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Not Found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.maintenanceWindow.delete({ where: { id } });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: "maintenance_window.delete",
          resource: "maintenance_window",
          resourceId: id,
          detail: {},
        },
        tx,
      );
    });

    logger.info("Maintenance window deleted", {
      actorId: actor.id,
      windowId: id,
    });

    return Response.json({ id });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;

    logger.error("Admin maintenance delete failed", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
