"use client";

import {
  Clock3,
  Heart,
  Star,
  Tag,
  Trophy,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NoticesCard } from "@/components/dashboard/notices-card";
import { AppShell } from "@/components/navigation/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NoticeListLoadingCard } from "@/components/notices/notice-list-card";
import {
  type ActiveFanSummary,
  type EventAndSupportSummary,
  type RoomProfile,
} from "@/lib/showroom";
import {
  createShowroomSubscribeMessage,
  getShowroomSocketPayloadText,
  SHOWROOM_LIVE_STARTED_MESSAGE_TYPE,
  SHOWROOM_SOCKET_PING_MESSAGE,
  SHOWROOM_SOCKET_URL,
} from "@/lib/showroom-realtime";
import type {
  DashboardBffResponse,
  DashboardData,
  DashboardRealtimeMessage,
  DashboardStat,
} from "@/types/pages/dashboard";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1600&q=80";
const EVENT_IMAGE =
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80";
const DASHBOARD_SOCKET_PING_INTERVAL_MS = 60_000;

function formatTime(unixSeconds: number | null | undefined): string {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) {
    return "未定";
  }

  const date = new Date(unixSeconds * 1000);
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}年${get("month")}月${get("day")}日（${get(
    "weekday"
  )}） ${get("hour")}時${get("minute")}分`;
}

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

function toRealtimeMessageType(
  value: number | string | null | undefined
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isLiveStartedSocketMessage(
  rawMessage: string,
  broadcastKey: string
): boolean {
  const jsonText = getShowroomSocketPayloadText(rawMessage, broadcastKey);

  if (!jsonText || !jsonText.startsWith("{")) {
    return false;
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return false;
    }

    return (
      toRealtimeMessageType((parsed as DashboardRealtimeMessage).t) ===
      SHOWROOM_LIVE_STARTED_MESSAGE_TYPE
    );
  } catch {
    return false;
  }
}

function createRoomStats(
  profile: RoomProfile | null,
  activeFan: ActiveFanSummary | null
): DashboardStat[] {
  return [
    {
      title: "フォロワー数",
      value: profile ? `${profile.followerNum} 人` : "取得できませんでした",
      icon: Users,
    },
    {
      title: activeFan?.fanName ?? "アクティブファン",
      value: activeFan
        ? `${activeFan.totalUserCount} 人`
        : "取得できませんでした",
      icon: Heart,
    },
    {
      title: "ルームレベル",
      value: profile ? `${profile.roomLevel} Lv` : "取得できませんでした",
      icon: Star,
    },
    {
      title: "次回配信予定",
      value: formatTime(profile?.currentLiveStartedAt),
      icon: Clock3,
    },
    {
      title: "SHOWランク",
      value: profile
        ? `${profile.showRankSubdivided}${profile.showRankTimeCharge
          ? `（${profile.showRankTimeCharge}/1時間）`
          : ""
        }`
        : "取得できませんでした",
      icon: Trophy,
    },
    {
      title: "ジャンル",
      value: profile?.genreName ?? "取得できませんでした",
      icon: Tag,
    },
  ];
}

function HeroCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-3xl border-0 py-0 shadow-sm">
      <Skeleton className="h-56 w-full rounded-none sm:h-72 lg:h-80" />
    </Card>
  );
}

function StatsCardSkeleton() {
  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

function RoomStatsSectionSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </section>
  );
}

function EventOverviewCardSkeleton() {
  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-48" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-2xl bg-slate-50 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-28" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsCard({ title, value, icon: Icon }: DashboardStat) {
  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>
          <p className="truncate text-lg font-semibold text-slate-900">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function HeroCard({ profile }: { profile: RoomProfile | null }) {
  return (
    <Card className="overflow-hidden rounded-3xl border-0 py-0 shadow-sm">
      <div className="relative h-56 w-full sm:h-72 lg:h-80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile?.roomImageUrl || HERO_IMAGE}
          alt={profile?.roomName || "ルーム画像"}
          className="h-full w-full object-cover"
          width={1600}
          height={900}
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/65 via-black/30 to-transparent" />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 sm:left-8">
          <Badge className="mb-3 rounded-full bg-white/20 px-3 py-1 text-white backdrop-blur">
            {profile?.isOfficial ? "公式枠ルーム" : "フリー枠ルーム"}
          </Badge>
          <h1 className="max-w-[80%] text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            {profile?.roomName || "ルーム情報を取得できませんでした"}
          </h1>
        </div>
      </div>
    </Card>
  );
}

function RoomStatsSection({
  profile,
  activeFan,
}: {
  profile: RoomProfile | null;
  activeFan: ActiveFanSummary | null;
}) {
  const stats = createRoomStats(profile, activeFan);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => (
        <StatsCard key={stat.title} {...stat} />
      ))}
    </section>
  );
}

function EventOverviewCard({
  eventAndSupport,
}: {
  eventAndSupport: EventAndSupportSummary | null;
}) {
  if (!eventAndSupport?.event && !eventAndSupport?.support) {
    return null;
  }

  const title = eventAndSupport.event ? "開催中のイベント" : "";
  const badgeLabel = eventAndSupport.event ? "参加中" : "";
  const campaignName =
    eventAndSupport.event?.name ??
    eventAndSupport.support?.name ??
    "情報を取得できませんでした";
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={eventAndSupport.event?.imageUrl ?? EVENT_IMAGE}
      alt={campaignName}
      className="h-56 w-full object-cover lg:h-full"
      width={1280}
      height={720}
    />
  );

  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">{title}</CardTitle>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl">
            {eventAndSupport.event?.eventUrl ? (
              <a
                href={eventAndSupport.event.eventUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {image}
              </a>
            ) : (
              image
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-slate-500">
                {eventAndSupport.event ? "イベント名" : "サポート名"}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {campaignName}
              </h2>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">現在順位</p>
              <p className="mt-1 font-semibold text-slate-900">
                {eventAndSupport.ranking
                  ? `${eventAndSupport.ranking.rank} 位`
                  : "順位情報はありません"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">現在のポイント</p>
              <p className="mt-1 font-semibold text-slate-900">
                {eventAndSupport.ranking
                  ? `${eventAndSupport.ranking.point} pt（${eventAndSupport.ranking.rank === 1
                    ? `2位との差 ${eventAndSupport.ranking.gap} pt`
                    : `次順位まで ${eventAndSupport.ranking.gap} pt`
                  }）`
                  : "ポイント情報はありません"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">開始日時</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatTime(eventAndSupport.event?.startAt)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">終了日時</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatTime(eventAndSupport.event?.endAt)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Page() {
  const router = useRouter();
  const [canShowDashboard, setCanShowDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
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

      const { profile, activeFan, eventAndSupport, notices, noticesHasError, roomStatus } = bffData;

      setDashboardData({ profile, activeFan, eventAndSupport, notices, noticesHasError });
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

  const { profile, activeFan, eventAndSupport, notices, noticesHasError } = dashboardData;

  return (
    <AppShell activeKey="dashboard">
      <div className="flex shrink-0 flex-col gap-4">
        <HeroCard profile={profile} />
        <RoomStatsSection profile={profile} activeFan={activeFan} />
        <EventOverviewCard eventAndSupport={eventAndSupport} />
        <NoticesCard notices={notices} hasError={noticesHasError} />
      </div>
    </AppShell>
  );
}
