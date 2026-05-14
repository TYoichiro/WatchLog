import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RoomListPage, type RoomListItem } from "@/components/admin/room-list-page";
import { AppShell } from "@/components/navigation/app-sidebar";
import { hasTopAdminRole } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { listAllRegisteredRooms } from "@/lib/user-registered-room";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ルーム一覧 | WatchLog",
};

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const isAdmin = await hasTopAdminRole(userId);

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const rooms = await listAllRegisteredRooms();

  const roomItems: RoomListItem[] = rooms.map((room) => ({
    id: room.id,
    roomId: room.roomId,
    roomUrl: room.roomUrl,
    roomName: room.roomName,
    imageUrl: room.imageUrl,
    createdAt: toJstWallTimeIsoString(room.createdAt),
    user: {
      id: room.user.id,
      name: room.user.name,
    },
  }));

  return (
    <AppShell activeKey="admin-rooms" isAdmin>
      <RoomListPage rooms={roomItems} />
    </AppShell>
  );
}
