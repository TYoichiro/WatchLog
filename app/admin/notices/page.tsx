import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  NoticesPage,
  type NoticeItem,
} from "@/components/admin/notices-page";
import { AppShell } from "@/components/navigation/app-sidebar";
import { hasTopAdminRole } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "お知らせ管理 | WatchLog",
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

  const notices = await prisma.dashboardNotice.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      content: true,
      displayTarget: true,
      publishedAt: true,
      expiresAt: true,
      linkUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const items: NoticeItem[] = notices.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    displayTarget: n.displayTarget,
    publishedAt: toJstWallTimeIsoString(n.publishedAt),
    expiresAt: n.expiresAt ? toJstWallTimeIsoString(n.expiresAt) : null,
    linkUrl: n.linkUrl,
    createdAt: toJstWallTimeIsoString(n.createdAt),
    updatedAt: toJstWallTimeIsoString(n.updatedAt),
  }));

  return (
    <AppShell activeKey="admin-notices" isAdmin>
      <NoticesPage initialNotices={items} />
    </AppShell>
  );
}
