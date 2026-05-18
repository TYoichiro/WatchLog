import type { EventAndSupportSummary } from "@/lib/showroom";
import { cn, formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function EventOverviewCardSkeleton() {
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

export function EventOverviewCard({
  eventAndSupport,
}: {
  eventAndSupport: EventAndSupportSummary | null;
}) {
  if (!eventAndSupport?.event && !eventAndSupport?.support) {
    return null;
  }

  const hasEvent = !!eventAndSupport.event;
  const title = hasEvent ? "開催中のイベント" : "サポート中";
  const campaignName =
    eventAndSupport.event?.name ??
    eventAndSupport.support?.name ??
    "情報を取得できませんでした";
  const imageUrl = eventAndSupport.event?.imageUrl;

  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">{title}</CardTitle>
          {hasEvent && (
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              参加中
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-5", imageUrl && "lg:grid-cols-[320px_minmax(0,1fr)]")}>
          {imageUrl && (
            <div className="overflow-hidden rounded-2xl">
              {eventAndSupport.event?.eventUrl ? (
                <a
                  href={eventAndSupport.event.eventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={campaignName}
                    className="h-56 w-full object-cover lg:h-full"
                    width={1280}
                    height={720}
                  />
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={campaignName}
                  className="h-56 w-full object-cover lg:h-full"
                  width={1280}
                  height={720}
                />
              )}
            </div>
          )}

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
