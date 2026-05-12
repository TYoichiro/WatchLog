import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LocalLogViewerPage } from "@/components/logs/local-log-viewer-page";

export const metadata: Metadata = {
  title: "配信ログ詳細 | WatchLog",
};

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const { roomId } = await params;

  return <LocalLogViewerPage roomId={roomId} />;
}
