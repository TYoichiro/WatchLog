"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Gift,
  MessageSquareText,
  Minus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  OnliveSummary,
  OnliveSummaryComparison,
  SummaryDelta,
  SummaryRankedUser,
} from "@/lib/onlive-summary";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "--";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}時間${String(minutes).padStart(2, "0")}分`;
  }

  return `${minutes}分${String(remainSeconds).padStart(2, "0")}秒`;
}

function getAvatarLabel(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() || "?";
}

function SummaryAvatar({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
      {getAvatarLabel(name)}
    </div>
  );
}

function DeltaBadge({
  delta,
  suffix = "",
}: {
  delta: SummaryDelta | null;
  suffix?: string;
}) {
  if (!delta) {
    return null;
  }

  const value = delta.delta;
  const className =
    value > 0
      ? "bg-emerald-50 text-emerald-700"
      : value < 0
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-500";
  const icon =
    value > 0 ? (
      <ArrowUpRight className="h-3 w-3" />
    ) : value < 0 ? (
      <ArrowDownRight className="h-3 w-3" />
    ) : (
      <Minus className="h-3 w-3" />
    );
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "±";

  return (
    <span
      className={cn(
        "mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="break-words">
        前回比 {prefix}
        {formatNumber(Math.abs(value))}
        {suffix}
      </span>
    </span>
  );
}

function MetricTile({
  label,
  value,
  sub,
  delta,
  deltaSuffix,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: SummaryDelta | null;
  deltaSuffix?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold break-words text-slate-900 sm:text-2xl">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs break-words text-slate-500">{sub}</p>
      ) : null}
      <div>
        <DeltaBadge delta={delta ?? null} suffix={deltaSuffix} />
      </div>
    </div>
  );
}

function RankingList({
  emptyMessage,
  icon,
  items,
  title,
  unit,
}: {
  emptyMessage: string;
  icon: ReactNode;
  items: readonly SummaryRankedUser[];
  title: string;
  unit: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span className="shrink-0">{icon}</span>
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyMessage}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.userId ?? item.userName}-${index}`}
              className="flex items-center gap-3"
            >
              <span className="w-5 shrink-0 text-sm font-semibold text-slate-400">
                {index + 1}
              </span>
              <SummaryAvatar avatarUrl={item.avatarUrl} name={item.userName} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                {item.userName}
              </span>
              <span className="shrink-0 text-sm font-semibold text-slate-900">
                {formatNumber(item.value)}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  {unit}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function LiveSummaryDialog({
  summary,
  comparison,
  previousLabel,
}: {
  summary: OnliveSummary;
  comparison: OnliveSummaryComparison | null;
  previousLabel: string | null;
}) {
  const [open, setOpen] = useState(false);

  const followerGainText =
    summary.followerGain === null
      ? "--"
      : `${summary.followerGain >= 0 ? "+" : "-"}${formatNumber(
          Math.abs(summary.followerGain)
        )}`;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer gap-1.5 rounded-xl"
        onClick={() => setOpen(true)}
      >
        <BarChart3 className="h-4 w-4" />
        配信サマリー
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] w-[92vw] max-w-2xl overflow-x-hidden overflow-y-auto rounded-3xl">
          <DialogTitle>配信サマリー</DialogTitle>
          <DialogDescription>
            この配信の振り返りレポートです。
            {comparison
              ? previousLabel
                ? `前回（${previousLabel}）との比較を表示しています。`
                : "前回配信との比較を表示しています。"
              : "前回配信との比較は、保存された過去ログがある場合に表示されます。"}
          </DialogDescription>

          <div className="min-w-0 space-y-5">
            <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">配信時間</p>
              <p className="mt-1 text-xl font-bold break-words text-slate-900 sm:text-2xl">
                {formatDuration(summary.durationSeconds)}
              </p>
              <div>
                <DeltaBadge
                  delta={comparison?.durationSeconds ?? null}
                  suffix="秒"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricTile
                label="獲得ポイント"
                value={`${formatNumber(summary.totalPoints)} pt`}
                sub={`有料 ${formatNumber(summary.paidPoints)} / 無料 ${formatNumber(
                  summary.freePoints
                )}`}
                delta={comparison?.totalPoints ?? null}
                deltaSuffix=" pt"
              />
              <MetricTile
                label="フォロワー増減"
                value={`${followerGainText} 人`}
                sub={
                  summary.followerEnd === null
                    ? undefined
                    : `現在 ${formatNumber(summary.followerEnd)} 人`
                }
                delta={comparison?.followerGain ?? null}
                deltaSuffix=" 人"
              />
              <MetricTile
                label="新規フォロー"
                value={`${formatNumber(summary.newFollowerCount)} 件`}
                delta={comparison?.newFollowerCount ?? null}
                deltaSuffix=" 件"
              />
              <MetricTile
                label="初見・初訪問"
                value={`${formatNumber(summary.firstVisitCount)} 件`}
              />
              <MetricTile
                label="コメント数"
                value={`${formatNumber(summary.commentCount)} 件`}
                sub={`コメンター ${formatNumber(summary.commenterCount)} 人`}
                delta={comparison?.commentCount ?? null}
                deltaSuffix=" 件"
              />
              <MetricTile
                label="ギフト数"
                value={`${formatNumber(summary.giftCount)} 件`}
                sub={`ギフター ${formatNumber(summary.gifterCount)} 人`}
                delta={comparison?.giftCount ?? null}
                deltaSuffix=" 件"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <RankingList
                title="トップギフター"
                icon={<Gift className="h-4 w-4 text-amber-500" />}
                items={summary.topGifters}
                unit="pt"
                emptyMessage="ギフトはありませんでした"
              />
              <RankingList
                title="トップコメンター"
                icon={<MessageSquareText className="h-4 w-4 text-sky-500" />}
                items={summary.topCommenters}
                unit="件"
                emptyMessage="コメントはありませんでした"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
