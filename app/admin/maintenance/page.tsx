import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  MaintenancePage,
  type MaintenanceItem,
} from "@/components/admin/maintenance-page";
import { AppShell } from "@/components/navigation/app-sidebar";
import { hasTopAdminRole } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { listAllMaintenanceWindows } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "メンテナンス設定 | WatchLog",
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

  const windows = await listAllMaintenanceWindows();

  const items: MaintenanceItem[] = windows.map((w) => ({
    id: w.id,
    title: w.title,
    message: w.message,
    startsAt: toJstWallTimeIsoString(w.startsAt),
    endsAt: toJstWallTimeIsoString(w.endsAt),
    isEnabled: w.isEnabled,
    createdAt: toJstWallTimeIsoString(w.createdAt),
    updatedAt: toJstWallTimeIsoString(w.updatedAt),
  }));

  return (
    <AppShell activeKey="admin-maintenance" isAdmin>
      <MaintenancePage initialWindows={items} />
    </AppShell>
  );
}
