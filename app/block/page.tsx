import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "ブロックリスト | WatchLog",
};
import { BlockListPage } from "@/components/block/block-list-page";
import { AppShell } from "@/components/navigation/app-sidebar";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const registeredRoom = await getUserRegisteredRoom(userId);

  if (!registeredRoom) {
    redirect("/search");
  }

  return (
    <AppShell activeKey="block">
      <BlockListPage roomId={registeredRoom.roomId} />
    </AppShell>
  );
}
