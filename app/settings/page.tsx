import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/navigation/app-sidebar";
import { InvitationCodeCard } from "@/components/settings/invitation-code-card";
import { RoleCard } from "@/components/settings/role-card";
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

  const activeCount = invitationCodes.filter((c) => c.isActive).length;
  const usedCount = invitationCodes.filter((c) => !c.isActive).length;
  const invitationHeading = isAdmin
    ? `招待コード（現在${activeCount}名招待できるコードがあります　未利用：${activeCount}件　使用済み：${usedCount}件）`
    : "招待コード（最大3名まで招待することができます）";

  return (
    <AppShell activeKey="settings" isAdmin={isAdmin}>
      <section className="shrink-0">
        <h1 className="text-xl font-semibold text-slate-950">設定</h1>
      </section>

      <div className="shrink-0">
        <RoleCard roleLabel={roleLabel} />
      </div>
      <div className="shrink-0">
        <InvitationCodeCard
          invitationCodes={invitationCodes}
          isAdmin={isAdmin}
          heading={invitationHeading}
        />
      </div>
    </AppShell>
  );
}
