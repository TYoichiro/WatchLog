import { prisma } from "@/lib/prisma";
import {
  formatJstWallDateTime,
  toJstWallTimeDate,
} from "@/lib/jst";

export type ActiveMaintenanceWindow = {
  id: string;
  title: string;
  message: string | null;
  startsAt: Date;
  endsAt: Date;
  period: string;
};

const activeMaintenanceWindowSelect = {
  id: true,
  title: true,
  message: true,
  startsAt: true,
  endsAt: true,
} as const;

export async function getActiveMaintenanceWindow(
  now = toJstWallTimeDate(),
): Promise<ActiveMaintenanceWindow | null> {
  const maintenanceWindow = await prisma.maintenanceWindow.findFirst({
    where: {
      isEnabled: true,
      startsAt: {
        lte: now,
      },
      endsAt: {
        gt: now,
      },
    },
    orderBy: [
      {
        startsAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: activeMaintenanceWindowSelect,
  });

  if (!maintenanceWindow) {
    return null;
  }

  return {
    ...maintenanceWindow,
    period: formatMaintenancePeriod(
      maintenanceWindow.startsAt,
      maintenanceWindow.endsAt,
    ),
  };
}

function formatMaintenancePeriod(startsAt: Date, endsAt: Date): string {
  return `${formatMaintenanceDateTime(startsAt)}〜${formatMaintenanceDateTime(
    endsAt,
  )}`;
}

function formatMaintenanceDateTime(date: Date): string {
  return formatJstWallDateTime(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
