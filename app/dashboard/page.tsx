"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EventOverviewCard, EventOverviewCardSkeleton } from "@/components/dashboard/event-overview-card";
import { HeroCard, HeroCardSkeleton } from "@/components/dashboard/hero-card";
import { RoomStatsSection, RoomStatsSectionSkeleton } from "@/components/dashboard/room-stats-section";
import { AppShell } from "@/components/navigation/app-sidebar";
import { NoticeListCard, NoticeListLoadingCard } from "@/components/notices/notice-list-card";
import {
  createShowroomSubscribeMessage,
  isLiveStartedSocketMessage,
  SHOWROOM_SOCKET_PING_MESSAGE,
  SHOWROOM_SOCKET_URL,
} from "@/lib/showroom-realtime";
import type {
  DashboardBffResponse,
  DashboardData,
} from "@/types/pages/dashboard";

const DASHBOARD_SOCKET_PING_INTERVAL_MS = 60_000;

async function fetchDashboard(signal: AbortSignal): Promise<DashboardBffResponse> {
  const response = await fetch("/api/dashboard", {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard");
  }

  return (await response.json()) as DashboardBffResponse;
}

export default function Page() {
  const router = useRouter();
  const [canShowDashboard, setCanShowDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    isAdmin: false,
    profile: null,
    activeFan: null,
    eventAndSupport: null,
    notices: [],
    noticesHasError: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;
    let socket: WebSocket | null = null;
    let shouldReloadOnSocketClose = false;
    let pingIntervalId: number | null = null;

    const clearPingInterval = () => {
      if (pingIntervalId !== null) {
        window.clearInterval(pingIntervalId);
        pingIntervalId = null;
      }
    };

    const closeDashboardSocket = () => {
      shouldReloadOnSocketClose = false;
      clearPingInterval();

      if (
        socket &&
        socket.readyState !== WebSocket.CLOSING &&
        socket.readyState !== WebSocket.CLOSED
      ) {
        socket.close();
      }

      socket = null;
    };

    const navigateFromDashboard = (path: "/onlive" | "/search") => {
      if (!isActive) {
        return;
      }

      isActive = false;
      controller.abort();
      closeDashboardSocket();
      router.replace(path);
    };

    const reloadOnUnexpectedSocketClose = () => {
      if (!isActive || !shouldReloadOnSocketClose) {
        return;
      }

      shouldReloadOnSocketClose = false;
      clearPingInterval();
      window.location.reload();
    };

    function startLiveStartWatcher(broadcastKey: string) {
      const currentSocket = new WebSocket(SHOWROOM_SOCKET_URL);
      socket = currentSocket;
      shouldReloadOnSocketClose = true;

      currentSocket.addEventListener("open", () => {
        try {
          if (!isActive || currentSocket.readyState !== WebSocket.OPEN) {
            return;
          }

          currentSocket.send(createShowroomSubscribeMessage(broadcastKey));
          pingIntervalId = window.setInterval(() => {
            try {
              if (currentSocket.readyState !== WebSocket.OPEN) {
                reloadOnUnexpectedSocketClose();
                return;
              }

              currentSocket.send(SHOWROOM_SOCKET_PING_MESSAGE);
            } catch {
              reloadOnUnexpectedSocketClose();
            }
          }, DASHBOARD_SOCKET_PING_INTERVAL_MS);
        } catch {
          reloadOnUnexpectedSocketClose();
        }
      });

      currentSocket.addEventListener("message", (event) => {
        if (!isActive || typeof event.data !== "string") {
          return;
        }

        if (isLiveStartedSocketMessage(event.data, broadcastKey)) {
          navigateFromDashboard("/onlive");
        }
      });

      currentSocket.addEventListener("error", () => {
        reloadOnUnexpectedSocketClose();
      });

      currentSocket.addEventListener("close", () => {
        if (socket === currentSocket) {
          socket = null;
        }

        reloadOnUnexpectedSocketClose();
      });
    }

    async function initializeDashboard() {
      let bffData: DashboardBffResponse;

      try {
        bffData = await fetchDashboard(controller.signal);
      } catch (error) {
        if ((error as Error).name === "AbortError" || !isActive) {
          return;
        }

        navigateFromDashboard("/search");
        return;
      }

      if (!isActive) {
        return;
      }

      if (bffData.status === "no_room") {
        navigateFromDashboard("/search");
        return;
      }

      if (bffData.status === "is_live") {
        navigateFromDashboard("/onlive");
        return;
      }

      const { isAdmin: bffIsAdmin, profile, activeFan, eventAndSupport, notices, noticesHasError, roomStatus } = bffData;

      setDashboardData({ isAdmin: bffIsAdmin, profile, activeFan, eventAndSupport, notices, noticesHasError });
      setCanShowDashboard(true);

      const broadcastKey = roomStatus?.broadcastKey?.trim();
      if (!bffData.isAdmin && broadcastKey) {
        startLiveStartWatcher(broadcastKey);
      }
    }

    const timeoutId = window.setTimeout(() => {
      void initializeDashboard();
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      controller.abort();
      closeDashboardSocket();
    };
  }, [router]);

  if (!canShowDashboard) {
    return (
      <AppShell activeKey="dashboard">
        <div className="flex shrink-0 flex-col gap-4">
          <HeroCardSkeleton />
          <RoomStatsSectionSkeleton />
          <EventOverviewCardSkeleton />
          <NoticeListLoadingCard />
        </div>
      </AppShell>
    );
  }

  const { isAdmin, profile, activeFan, eventAndSupport, notices, noticesHasError } = dashboardData;

  return (
    <AppShell activeKey="dashboard" isAdmin={isAdmin}>
      <div className="flex shrink-0 flex-col gap-4">
        <HeroCard profile={profile} />
        <RoomStatsSection profile={profile} activeFan={activeFan} />
        <EventOverviewCard eventAndSupport={eventAndSupport} />
        <NoticeListCard notices={notices} hasError={noticesHasError} />
      </div>
    </AppShell>
  );
}
