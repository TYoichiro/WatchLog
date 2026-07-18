import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  OnliveLogViewerPage,
  type OnliveLogViewerData,
} from "@/components/onlive/onlive-room-page";
import { getUserRoles } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import {
  getAnyOnliveLog,
  getPreviousOnliveLog,
  getUserOnliveLog,
  type OnliveLogDetail,
  type PreviousOnliveLog,
} from "@/lib/onlive-log";

export const metadata: Metadata = {
  title: "配信ログ詳細 | WatchLog",
};

export const dynamic = "force-dynamic";

function toViewerData(
  log: OnliveLogDetail,
  previous: PreviousOnliveLog | null
): OnliveLogViewerData {
  return {
    capturedAt: toJstWallTimeIsoString(log.capturedAt),
    createdAt: toJstWallTimeIsoString(log.createdAt),
    id: log.id,
    liveId: log.liveId,
    liveStartedAt: log.liveStartedAt,
    log: log.log,
    previousLog: previous?.log ?? null,
    previousCapturedAt: previous
      ? toJstWallTimeIsoString(previous.capturedAt)
      : null,
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

  const { isAdmin, isPremium } = await getUserRoles(userId);
  const log = isAdmin
    ? await getAnyOnliveLog(logId)
    : await getUserOnliveLog(userId, logId);

  if (!log) {
    notFound();
  }

  const previousLog = await getPreviousOnliveLog(log.roomId, log.capturedAt);

  return (
    <OnliveLogViewerPage
      data={toViewerData(log, previousLog)}
      isAdmin={isAdmin}
      isPremium={isPremium}
    />
  );
}
