import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "配信ログ | WatchLog",
};
import { LogListPage, type LogListItem } from "@/components/logs/log-list-page";
import { AppShell } from "@/components/navigation/app-sidebar";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { listUserOnliveLogs, type OnliveLogListItem } from "@/lib/onlive-log";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";

export const dynamic = "force-dynamic";

function toListItem(log: OnliveLogListItem): LogListItem {
  return {
    capturedAt: toJstWallTimeIsoString(log.capturedAt),
    commentCount: log.commentCount,
    createdAt: toJstWallTimeIsoString(log.createdAt),
    giftCount: log.giftCount,
    id: log.id,
    liveId: log.liveId,
    liveRankingCount: log.liveRankingCount,
    roomId: log.roomId,
    roomName: log.roomName,
    totalRankingCount: log.totalRankingCount,
    updatedAt: toJstWallTimeIsoString(log.updatedAt),
  };
}

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const [registeredRoom, logs] = await Promise.all([
    getUserRegisteredRoom(userId),
    listUserOnliveLogs(userId),
  ]);

  if (!registeredRoom) {
    redirect("/search");
  }

  return (
    <AppShell activeKey="logs">
      <LogListPage initialLogs={logs.map(toListItem)} />
    </AppShell>
  );
}
