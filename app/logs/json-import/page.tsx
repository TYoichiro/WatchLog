import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { JsonImportViewerPage } from "@/components/logs/json-import-viewer-page";

export const metadata: Metadata = {
  title: "JSONログ閲覧 | WatchLog",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  return <JsonImportViewerPage />;
}
