import { prisma } from "@/lib/prisma";
import type { DashboardNoticeTarget } from "@/app/generated/prisma/enums";
import {
  formatJstWallDateTime,
  toJstWallTimeDate,
} from "@/lib/jst";

export type NoticeSurface = "authenticated" | "login";

export type AppNotice = {
  id: number;
  title: string;
  date: string;
  body: string;
  linkUrl: string | null;
};

export type DashboardNotice = AppNotice;

const noticeSurfaceTargets = {
  authenticated: ["AUTHENTICATED", "ALL"],
  login: ["LOGIN", "ALL"],
} satisfies Record<NoticeSurface, readonly DashboardNoticeTarget[]>;

const dashboardNoticeSelect = {
  id: true,
  title: true,
  content: true,
  publishedAt: true,
  linkUrl: true,
} as const;

export async function getNotices(surface: NoticeSurface): Promise<AppNotice[]> {
  const now = toJstWallTimeDate();
  const notices = await prisma.dashboardNotice.findMany({
    where: {
      displayTarget: {
        in: [...noticeSurfaceTargets[surface]],
      },
      publishedAt: {
        lte: now,
      },
      OR: [
        {
          expiresAt: null,
        },
        {
          expiresAt: {
            gt: now,
          },
        },
      ],
    },
    orderBy: [
      {
        publishedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    select: dashboardNoticeSelect,
  });

  return notices.map((notice) => ({
    id: notice.id,
    title: notice.title,
    date: formatDashboardNoticeDate(notice.publishedAt),
    body: notice.content,
    linkUrl: normalizeNoticeLinkUrl(notice.linkUrl),
  }));
}

export function getDashboardNotices(): Promise<AppNotice[]> {
  return getNotices("authenticated");
}

export function getLoginNotices(): Promise<AppNotice[]> {
  return getNotices("login");
}

function formatDashboardNoticeDate(date: Date): string {
  return formatJstWallDateTime(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeNoticeLinkUrl(url: string | null): string | null {
  const trimmedUrl = url?.trim();
  if (!trimmedUrl) {
    return null;
  }

  try {
    const parsed = new URL(trimmedUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}
