import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  NoticesPage,
  type NoticeItem,
} from "@/components/admin/notices-page";
import { AppShell } from "@/components/navigation/app-sidebar";
import { noticeSelect, serializeNotice } from "@/lib/admin-notices";
import { hasTopAdminRole } from "@/lib/authz";
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
    select: noticeSelect,
  });

  const items: NoticeItem[] = notices.map(serializeNotice);

  return (
    <AppShell activeKey="admin-notices" isAdmin>
      <NoticesPage initialNotices={items} />
    </AppShell>
  );
}
