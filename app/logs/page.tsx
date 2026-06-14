import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LogListPage, type LogListItem } from "@/components/logs/log-list-page";
import { AppShell } from "@/components/navigation/app-sidebar";
import { getUserRoles } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { listAllOnliveLogs, listUserOnliveLogs, type OnliveLogListItem } from "@/lib/onlive-log";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";

export const metadata: Metadata = {
  title: "配信ログ | WatchLog",
};

export const dynamic = "force-dynamic";

function toListItem(log: OnliveLogListItem): LogListItem {
  return {
    capturedAt: toJstWallTimeIsoString(log.capturedAt),
    commentCount: log.commentCount,
    createdAt: toJstWallTimeIsoString(log.createdAt),
    giftCount: log.giftCount,
    id: log.id,
    isFavorite: log.isFavorite,
    liveId: log.liveId,
    roomId: log.roomId,
    roomName: log.roomName,
    title: log.title,
    updatedAt: toJstWallTimeIsoString(log.updatedAt),
  };
}

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const { isAdmin, isPremium } = await getUserRoles(userId);

  if (isAdmin) {
    const logs = await listAllOnliveLogs(userId);
    return (
      <AppShell activeKey="logs" isAdmin>
        <LogListPage initialLogs={logs.map(toListItem)} />
      </AppShell>
    );
  }

  const registeredRoom = await getUserRegisteredRoom(userId);

  if (!registeredRoom) {
    redirect("/search");
  }

  if (!isPremium) {
    return (
      <AppShell activeKey="logs">
        <LogListPage initialLogs={[]} isPremium={false} roomId={registeredRoom.roomId} />
      </AppShell>
    );
  }

  const logs = await listUserOnliveLogs(userId);

  return (
    <AppShell activeKey="logs" isPremium={isPremium}>
      <LogListPage initialLogs={logs.map(toListItem)} />
    </AppShell>
  );
}
