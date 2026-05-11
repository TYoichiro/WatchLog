import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/navigation/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { hasTopAdminRole, hasPremiumRole } from "@/lib/authz";
import { listUserInvitationCodes } from "@/lib/invitations";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "設定 | WatchLog",
};

function getRoleLabel(isAdmin: boolean, isPremium: boolean): string {
  if (isAdmin) return "管理者";
  if (isPremium) return "プレミアム";
  return "一般";
}

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const [registeredRoom, invitationCodes, isAdmin, isPremium] = await Promise.all([
    getUserRegisteredRoom(userId),
    listUserInvitationCodes(userId),
    hasTopAdminRole(userId),
    hasPremiumRole(userId),
  ]);

  if (!registeredRoom) {
    redirect("/search");
  }

  const roleLabel = getRoleLabel(isAdmin, isPremium);

  return (
    <AppShell activeKey="settings">
      <section className="shrink-0">
        <h1 className="text-xl font-semibold text-slate-950">設定</h1>
      </section>

      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-slate-950">権限</h2>
          </div>
          <p className="mt-4 text-sm text-slate-700">
            あなたは<span className="font-semibold">{roleLabel}</span>ユーザーです
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-slate-950">
              招待コード（最大3名まで招待することができます）
            </h2>
          </div>

          {invitationCodes.length > 0 ? (
            <div className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {invitationCodes.map((invitationCode) => (
                <div
                  key={invitationCode.code}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <span className="font-mono text-sm font-semibold text-slate-900">
                    {invitationCode.code}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      invitationCode.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }
                  >
                    {invitationCode.isActive ? "有効" : "無効"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
              招待コードはありません
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
