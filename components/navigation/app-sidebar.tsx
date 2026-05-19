"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  Ban,
  Bell,
  ChevronRight,
  Home,
  List,
  LogOut,
  Menu,
  Play,
  Settings,
  Tv,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavigationKey = "dashboard" | "logs" | "block" | "search" | "settings" | "admin-rooms" | "admin-maintenance" | "admin-notices" | "showtube";

type NavigationItem = {
  key: NavigationKey;
  label: string;
  href?: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  { key: "dashboard", label: "ホーム", href: "/dashboard", icon: Home },
  { key: "logs", label: "ログ閲覧", href: "/logs", icon: List },
  { key: "block", label: "ブロック", href: "/block", icon: Ban },
  { key: "settings", label: "設定", href: "/settings", icon: Settings },
];

const DESKTOP_SIDEBAR_QUERY = "(min-width: 1280px)";

function isDesktopSidebarLayout() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches
  );
}

function getActiveNavigationKey(pathname: string | null): NavigationKey {
  if (pathname?.startsWith("/admin/rooms")) {
    return "admin-rooms";
  }

  if (pathname?.startsWith("/admin/maintenance")) {
    return "admin-maintenance";
  }

  if (pathname?.startsWith("/admin/notices")) {
    return "admin-notices";
  }

  if (pathname?.startsWith("/showtube")) {
    return "showtube";
  }

  if (pathname?.startsWith("/logs")) {
    return "logs";
  }

  if (pathname?.startsWith("/search")) {
    return "search";
  }

  if (pathname?.startsWith("/block")) {
    return "block";
  }

  if (pathname?.startsWith("/settings")) {
    return "settings";
  }

  return "dashboard";
}

function SidebarContent({
  activeKey,
  isAdmin = false,
  isPremium = false,
  onSelect,
}: {
  activeKey: NavigationKey;
  isAdmin?: boolean;
  isPremium?: boolean;
  onSelect?: () => void;
}) {
  const [isSigningOut, startSignOutTransition] = useTransition();

  const handleSignOut = () => {
    startSignOutTransition(() => {
      void signOut({ redirectTo: "/" });
    });
  };

  return (
    <>
      {/* <div className="flex h-16 items-center border-b px-6">
        <div>
          <p className="text-xs font-medium tracking-[0.2em] text-slate-500">
            WATCHLOG
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Comment Dashboard
          </h2>
        </div>
      </div> */}

      <nav className="flex-1 space-y-1 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeKey;
          const className = cn(
            "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition",
            isActive
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          );
          const content = (
            <>
              <span className="flex items-center gap-3">
                <Icon className="h-5 w-5" aria-hidden />
                <span className="font-medium">{item.label}</span>
              </span>
              <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
            </>
          );

          if (!item.href) {
            return (
              <button
                key={item.key}
                type="button"
                className={className}
                onClick={onSelect}
                aria-current={isActive ? "page" : undefined}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={className}
              onClick={onSelect}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}

        {(isAdmin || isPremium) ? (
          <>
            <div className="my-2 border-t border-slate-100" />
            <p className="px-4 pb-1 text-xs font-medium tracking-wider text-slate-400">
              プレミア機能
            </p>
            <Link
              href="/showtube"
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition",
                activeKey === "showtube"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              onClick={onSelect}
              aria-current={activeKey === "showtube" ? "page" : undefined}
            >
              <span className="flex items-center gap-3">
                <Play className="h-5 w-5" aria-hidden />
                <span className="font-medium">ShowTube</span>
              </span>
              <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          </>
        ) : null}

        {isAdmin ? (
          <>
            <div className="my-2 border-t border-slate-100" />
            <p className="px-4 pb-1 text-xs font-medium tracking-wider text-slate-400">
              管理者
            </p>
            <Link
              href="/admin/rooms"
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition",
                activeKey === "admin-rooms"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              onClick={onSelect}
              aria-current={activeKey === "admin-rooms" ? "page" : undefined}
            >
              <span className="flex items-center gap-3">
                <Tv className="h-5 w-5" aria-hidden />
                <span className="font-medium">ルーム一覧</span>
              </span>
              <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
            <Link
              href="/admin/maintenance"
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition",
                activeKey === "admin-maintenance"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              onClick={onSelect}
              aria-current={activeKey === "admin-maintenance" ? "page" : undefined}
            >
              <span className="flex items-center gap-3">
                <Wrench className="h-5 w-5" aria-hidden />
                <span className="font-medium">メンテナンス</span>
              </span>
              <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
            <Link
              href="/admin/notices"
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition",
                activeKey === "admin-notices"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              onClick={onSelect}
              aria-current={activeKey === "admin-notices" ? "page" : undefined}
            >
              <span className="flex items-center gap-3">
                <Bell className="h-5 w-5" aria-hidden />
                <span className="font-medium">お知らせ</span>
              </span>
              <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          </>
        ) : null}
      </nav>

      <div className="space-y-3 border-t p-4">
        <p className="text-center text-xs text-slate-500">
          Create by{" "}
          <a
            href="https://x.com/yoichiro_sub"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
          >
            よーいちろー
          </a>
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-start gap-3 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          <LogOut className="h-5 w-5" aria-hidden />
          {isSigningOut ? "ログアウト中..." : "ログアウト"}
        </Button>
      </div>
    </>
  );
}

function MobileSidebar({
  activeKey,
  isAdmin = false,
  isPremium = false,
  open,
  onClose,
}: {
  activeKey: NavigationKey;
  isAdmin?: boolean;
  isPremium?: boolean;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 transition xl:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r bg-white shadow-2xl transition-transform duration-300 xl:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-slate-500">
              WATCHLOG
            </p>
            <h2 className="text-base font-semibold text-slate-900">メニュー</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={onClose}
            aria-label="メニューを閉じる"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <SidebarContent activeKey={activeKey} isAdmin={isAdmin} isPremium={isPremium} onSelect={onClose} />
      </aside>
    </>
  );
}

function AppSidebar({
  activeKey,
  isAdmin = false,
  isPremium = false,
  open,
}: {
  activeKey: NavigationKey;
  isAdmin?: boolean;
  isPremium?: boolean;
  open: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <aside className="hidden xl:flex xl:w-72 xl:flex-col xl:border-r xl:bg-white">
      <SidebarContent activeKey={activeKey} isAdmin={isAdmin} isPremium={isPremium} />
    </aside>
  );
}

function AppHeader({
  onToggleMenu,
  showMenu,
  isBrandLinkEnabled,
}: {
  onToggleMenu: () => void;
  showMenu: boolean;
  isBrandLinkEnabled: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-white/95 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        {showMenu ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={onToggleMenu}
            aria-label="メニューを切り替える"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
        <h1 className="text-base text-slate-900 sm:text-lg">
          {isBrandLinkEnabled ? (
            <Link
              href="/dashboard"
              className="rounded-sm transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              WatchLog
            </Link>
          ) : (
            "WatchLog"
          )}
        </h1>
      </div>
      <div className="shrink-0 text-sm font-medium text-slate-500">v3.0.0-β</div>
    </header>
  );
}

export function AppShell({
  activeKey,
  children,
  isAdmin = false,
  isPremium = false,
  mainClassName,
  showMenu = true,
}: {
  activeKey?: NavigationKey;
  children: ReactNode;
  isAdmin?: boolean;
  isPremium?: boolean;
  mainClassName?: string;
  showMenu?: boolean;
}) {
  const pathname = usePathname();
  const resolvedActiveKey = activeKey ?? getActiveNavigationKey(pathname);
  const isBrandLinkEnabled = !pathname?.startsWith("/onlive");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleToggleMenu = () => {
    if (isDesktopSidebarLayout()) {
      setDesktopSidebarOpen((prev) => !prev);
      return;
    }

    setMobileSidebarOpen((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 xl:h-screen xl:overflow-hidden">
      <div className="flex min-h-screen xl:h-screen">
        {showMenu ? (
          <>
            <AppSidebar activeKey={resolvedActiveKey} isAdmin={isAdmin} isPremium={isPremium} open={desktopSidebarOpen} />
            <MobileSidebar
              activeKey={resolvedActiveKey}
              isAdmin={isAdmin}
              isPremium={isPremium}
              open={mobileSidebarOpen}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col xl:h-screen xl:overflow-hidden">
          <AppHeader
            showMenu={showMenu}
            onToggleMenu={handleToggleMenu}
            isBrandLinkEnabled={isBrandLinkEnabled}
          />

          <main
            className={cn(
              "flex w-full flex-1 flex-col gap-4 p-4 xl:h-full xl:overflow-auto",
              mainClassName
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
