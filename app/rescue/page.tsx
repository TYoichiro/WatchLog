import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserRoles } from "@/lib/authz";
import { AppShell } from "@/components/navigation/app-sidebar";
import { RescuePage } from "@/components/rescue/rescue-page-loader";

export const metadata: Metadata = {
  title: "ログレスキュー | WatchLog",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const { isAdmin, isPremium } = await getUserRoles(userId);

  if (!isAdmin && !isPremium) {
    redirect("/dashboard");
  }

  return (
    <AppShell isAdmin={isAdmin} isPremium={isPremium}>
      <RescuePage />
    </AppShell>
  );
}
