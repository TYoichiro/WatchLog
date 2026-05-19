"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { ArrowLeft, ChevronRight, LogOut, Menu, Play, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShowTubeGenre = {
  genreId: number;
  genreName: string;
};

const DESKTOP_SIDEBAR_QUERY = "(min-width: 1280px)";

function isDesktopLayout() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches
  );
}

function SidebarContent({
  genres,
  selectedGenreId,
  onSelect,
}: {
  genres: ShowTubeGenre[];
  selectedGenreId: number | null;
  onSelect?: () => void;
}) {
  const [isSigningOut, startSignOutTransition] = useTransition();

  const handleSignOut = () => {
    startSignOutTransition(() => {
      void signOut({ redirectTo: "/" });
    });
  };

  const isAllActive = selectedGenreId === null;

  return (
    <>
      <nav className="flex-1 overflow-y-auto space-y-1 p-4">
        <Link
          href="/dashboard"
          className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          onClick={onSelect}
        >
          <span className="flex items-center gap-3">
            <ArrowLeft className="h-5 w-5" aria-hidden />
            <span className="font-medium">戻る</span>
          </span>
          <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
        </Link>

        <Link
          href="/showtube"
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition",
            isAllActive
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
          aria-current={isAllActive ? "page" : undefined}
          onClick={onSelect}
        >
          <span className="flex items-center gap-3">
            <Play className="h-5 w-5" aria-hidden />
            <span className="font-medium">ShowTube</span>
          </span>
          <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
        </Link>

        {genres.length > 0 && (
          <>
            <div className="my-2 border-t border-slate-100" />
            <p className="px-4 pb-1 text-xs font-medium tracking-wider text-slate-400">
              ジャンル
            </p>
            {genres.map((genre) => {
              const isActive = selectedGenreId === genre.genreId;
              return (
                <Link
                  key={genre.genreId}
                  href={`/showtube?genre=${genre.genreId}`}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  onClick={onSelect}
                >
                  <span className="font-medium">{genre.genreName}</span>
                  <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
                </Link>
              );
            })}
          </>
        )}
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

function DesktopSidebar({
  genres,
  selectedGenreId,
  open,
}: {
  genres: ShowTubeGenre[];
  selectedGenreId: number | null;
  open: boolean;
}) {
  if (!open) return null;

  return (
    <aside className="hidden xl:flex xl:w-72 xl:flex-col xl:border-r xl:bg-white">
      <SidebarContent genres={genres} selectedGenreId={selectedGenreId} />
    </aside>
  );
}

function MobileSidebar({
  genres,
  selectedGenreId,
  open,
  onClose,
}: {
  genres: ShowTubeGenre[];
  selectedGenreId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 transition xl:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r bg-white shadow-2xl transition-transform duration-300 xl:hidden",
          open ? "translate-x-0" : "-translate-x-full",
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
        <SidebarContent genres={genres} selectedGenreId={selectedGenreId} onSelect={onClose} />
      </aside>
    </>
  );
}

export function ShowTubeShell({
  children,
  genres,
  selectedGenreId,
}: {
  children?: ReactNode;
  genres: ShowTubeGenre[];
  selectedGenreId: number | null;
}) {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleToggleMenu = () => {
    if (isDesktopLayout()) {
      setDesktopSidebarOpen((prev) => !prev);
      return;
    }
    setMobileSidebarOpen((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 xl:h-screen xl:overflow-hidden">
      <div className="flex min-h-screen xl:h-screen">
        <DesktopSidebar genres={genres} selectedGenreId={selectedGenreId} open={desktopSidebarOpen} />
        <MobileSidebar
          genres={genres}
          selectedGenreId={selectedGenreId}
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col xl:h-screen xl:overflow-hidden">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-white/95 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-xl"
                onClick={handleToggleMenu}
                aria-label="メニューを切り替える"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-base text-slate-900 sm:text-lg">ShowTube</h1>
            </div>
            <div className="shrink-0 text-sm font-medium text-slate-500">v3.0.0-β</div>
          </header>

          <main className="flex w-full flex-1 flex-col gap-4 p-4 xl:h-full xl:overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
