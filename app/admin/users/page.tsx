import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { UserListPage, type UserListItem } from "@/components/admin/user-list-page";
import { AppShell } from "@/components/navigation/app-sidebar";
import { hasTopAdminRole } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ユーザー一覧 | WatchLog",
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

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isBanned: true,
      createdAt: true,
      userRoles: {
        select: {
          role: { select: { name: true } },
        },
      },
      registeredRoom: {
        select: {
          roomId: true,
          roomUrl: true,
          roomName: true,
        },
      },
    },
  });

  const userItems: UserListItem[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    isBanned: user.isBanned,
    createdAt: toJstWallTimeIsoString(user.createdAt),
    roles: user.userRoles.map((ur) => ({ name: ur.role.name })),
    registeredRoom: user.registeredRoom
      ? {
          roomId: user.registeredRoom.roomId,
          roomUrl: user.registeredRoom.roomUrl,
          roomName: user.registeredRoom.roomName,
        }
      : null,
  }));

  return (
    <AppShell activeKey="admin-users" isAdmin>
      <UserListPage users={userItems} currentUserId={userId} />
    </AppShell>
  );
}
