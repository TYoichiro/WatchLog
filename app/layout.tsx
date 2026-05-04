import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { getActiveMaintenanceWindow } from "@/lib/maintenance";
import { TooltipProvider } from "@/components/ui/tooltip";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const maintenancePath = "/maintenance";

export const metadata: Metadata = {
  title: "WathLog",
  description: "SRの配信ログを保存できるツールです",
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
