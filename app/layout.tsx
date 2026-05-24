import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { getActiveMaintenanceWindow } from "@/lib/maintenance";
import { TooltipProvider } from "@/components/ui/tooltip";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const maintenancePath = "/maintenance";
const bannedPath = "/banned";

export const metadata: Metadata = {
  title: "WatchLog",
  description: "SHOWROOMの配信ログを保存できるツールです",
  keywords: ["ショールーム", "SHOWROOM", "配信", "コメント", "ウォッチログ", "watchlog", "配信ログ", "コメントビューアー", "コメビュ"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-watchlog-pathname") ?? "";
  const activeMaintenanceWindow = await getActiveMaintenanceWindow();

  if (activeMaintenanceWindow && pathname !== maintenancePath) {
    redirect(maintenancePath);
  }

  if (pathname !== bannedPath && !pathname.startsWith("/api/")) {
    const session = await auth();
    const userId = session?.user?.id;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isBanned: true },
      });
      if (user?.isBanned) {
        redirect(bannedPath);
      }
    }
  }

  return (
    <html lang="ja" className={cn("font-sans", geist.variable)}>
      <body>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
