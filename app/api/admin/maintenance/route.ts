import { writeAuditLog } from "@/lib/audit";
import { authzErrorResponse, requireTopAdminRole } from "@/lib/authz";
import { parseJstWallTime, toJstWallTimeIsoString } from "@/lib/jst";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const maintenanceWindowSelect = {
  id: true,
  title: true,
  message: true,
  startsAt: true,
  endsAt: true,
  isEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function serializeWindow(w: {
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

export async function GET() {
  try {
    await requireTopAdminRole();

    const windows = await prisma.maintenanceWindow.findMany({
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      select: maintenanceWindowSelect,
    });

    return Response.json({
      maintenanceWindows: windows.map(serializeWindow),
    });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;

    logger.error("Admin maintenance list failed", { error: String(error) });
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
      message,
      startsAt: startsAtRaw,
      endsAt: endsAtRaw,
      isEnabled,
    } = body as Record<string, unknown>;

    if (typeof title !== "string" || title.trim() === "") {
      return Response.json({ error: "title is required" }, { status: 400 });
    }
    if (typeof startsAtRaw !== "string") {
      return Response.json({ error: "startsAt is required" }, { status: 400 });
    }
    if (typeof endsAtRaw !== "string") {
      return Response.json({ error: "endsAt is required" }, { status: 400 });
    }

    const startsAt = parseJstWallTime(startsAtRaw);
    if (!startsAt) {
      return Response.json({ error: "startsAt is invalid" }, { status: 400 });
    }
    const endsAt = parseJstWallTime(endsAtRaw);
    if (!endsAt) {
      return Response.json({ error: "endsAt is invalid" }, { status: 400 });
    }
    if (endsAt <= startsAt) {
      return Response.json(
        { error: "endsAt must be after startsAt" },
        { status: 400 },
      );
    }

    const trimmedTitle = title.trim();
    const trimmedMessage =
      typeof message === "string" && message.trim() !== ""
        ? message.trim()
        : null;
    const enabled = isEnabled === undefined ? true : Boolean(isEnabled);

    const created = await prisma.$transaction(async (tx) => {
      const window = await tx.maintenanceWindow.create({
        data: {
          title: trimmedTitle,
          message: trimmedMessage,
          startsAt,
          endsAt,
          isEnabled: enabled,
        },
        select: maintenanceWindowSelect,
      });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: "maintenance_window.create",
          resource: "maintenance_window",
          resourceId: window.id,
          detail: {
            title: window.title,
            startsAt: toJstWallTimeIsoString(window.startsAt),
            endsAt: toJstWallTimeIsoString(window.endsAt),
            isEnabled: window.isEnabled,
          },
        },
        tx,
      );

      return window;
    });

    logger.info("Maintenance window created", {
      actorId: actor.id,
      windowId: created.id,
    });

    return Response.json(
      { maintenanceWindow: serializeWindow(created) },
      { status: 201 },
    );
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) return authzResponse;

    logger.error("Admin maintenance create failed", { error: String(error) });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
