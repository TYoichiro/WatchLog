import { Clock3, Heart, Star, Tag, Trophy, Users } from "lucide-react";

import type { ActiveFanSummary, RoomProfile } from "@/lib/showroom";
import { formatTime } from "@/lib/utils";
import type { DashboardStat } from "@/types/pages/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

export function RoomStatsSectionSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </section>
  );
}

export function RoomStatsSection({
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
