import type { DashboardNoticeTarget } from "@/app/generated/prisma/enums";
import { toJstWallTimeIsoString } from "@/lib/jst";

export const noticeSelect = {
  id: true,
  title: true,
  content: true,
  displayTarget: true,
  publishedAt: true,
  expiresAt: true,
  linkUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const VALID_TARGETS: readonly DashboardNoticeTarget[] = [
  "AUTHENTICATED",
  "LOGIN",
  "ALL",
];

export function serializeNotice(n: {
  id: number;
  title: string;
  content: string;
  displayTarget: DashboardNoticeTarget;
  publishedAt: Date;
  expiresAt: Date | null;
  linkUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    displayTarget: n.displayTarget,
    publishedAt: toJstWallTimeIsoString(n.publishedAt),
    expiresAt: n.expiresAt ? toJstWallTimeIsoString(n.expiresAt) : null,
    linkUrl: n.linkUrl,
    createdAt: toJstWallTimeIsoString(n.createdAt),
    updatedAt: toJstWallTimeIsoString(n.updatedAt),
  };
}
