import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "配信ログ詳細 | WatchLog",
};
import {
  OnliveLogViewerPage,
  type OnliveLogViewerData,
} from "@/components/onlive/onlive-room-page";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { getAnyOnliveLog, getUserOnliveLog } from "@/lib/onlive-log";
import { hasTopAdminRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

function toViewerData(log: NonNullable<Awaited<ReturnType<typeof getUserOnliveLog>>>): OnliveLogViewerData {
  return {
    capturedAt: toJstWallTimeIsoString(log.capturedAt),
    createdAt: toJstWallTimeIsoString(log.createdAt),
    id: log.id,
    liveId: log.liveId,
    liveStartedAt: log.liveStartedAt,
    log: log.log,
    room: log.room,
    roomId: log.roomId,
    updatedAt: toJstWallTimeIsoString(log.updatedAt),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const { logId } = await params;
  const isAdmin = await hasTopAdminRole(userId);
  const log = isAdmin
    ? await getAnyOnliveLog(logId)
    : await getUserOnliveLog(userId, logId);

  if (!log) {
    notFound();
  }

  return <OnliveLogViewerPage data={toViewerData(log)} />;
}
