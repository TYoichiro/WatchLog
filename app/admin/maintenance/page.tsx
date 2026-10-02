import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  MaintenancePage,
  type MaintenanceItem,
} from "@/components/admin/maintenance-page";
import { AppShell } from "@/components/navigation/app-sidebar";
import { serializeWindow } from "@/lib/admin-maintenance";
import { hasTopAdminRole } from "@/lib/authz";
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

  const items: MaintenanceItem[] = windows.map(serializeWindow);

  return (
    <AppShell activeKey="admin-maintenance" isAdmin>
      <MaintenancePage initialWindows={items} />
    </AppShell>
  );
}
