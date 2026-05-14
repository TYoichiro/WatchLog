import type { Metadata } from "next";
import { Clock3, Wrench } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { StopMaintenanceButton } from "@/components/maintenance/stop-maintenance-button";
import { hasTopAdminRole } from "@/lib/authz";
import { getActiveMaintenanceWindow } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "メンテナンス中 | WatchLog",
};

export default async function MaintenancePage() {
  const maintenanceWindow = await getActiveMaintenanceWindow();

  if (!maintenanceWindow) {
    redirect("/");
  }

  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = userId ? await hasTopAdminRole(userId) : false;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-950">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Wrench className="size-6" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <Badge variant="outline" className="mb-4 border-amber-300 text-amber-700">
              Maintenance
            </Badge>

            <h1 className="text-2xl font-semibold sm:text-3xl">
              {maintenanceWindow.title}
            </h1>

            <div className="mt-5 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Clock3 className="mt-0.5 size-5 shrink-0 text-slate-600" aria-hidden="true" />
              <p className="text-base font-medium leading-7 text-slate-900">
                {maintenanceWindow.period} までメンテナンス中です。
              </p>
            </div>

            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600">
              {maintenanceWindow.message ??
                "ただいまシステムメンテナンスを実施しています。終了後に再度アクセスしてください。"}
            </p>

            {isAdmin ? (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <StopMaintenanceButton windowId={maintenanceWindow.id} />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
