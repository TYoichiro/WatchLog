import { Bell } from "lucide-react";

import type { AppNotice } from "@/lib/dashboard-notices";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NoticeListCardProps = {
  notices: AppNotice[];
  hasError?: boolean;
  className?: string;
};

export function NoticeListLoadingCard({ className }: { className?: string }) {
  return (
    <Card className={cn("rounded-3xl border-0 shadow-sm", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-xl">お知らせ</CardTitle>
          </div>
          <Badge variant="outline" className="rounded-full">
            読み込み中
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-100 p-4"
          >
            <div className="mb-3 h-5 w-3/5 animate-pulse rounded bg-slate-100" />
            <div className="mb-2 h-4 w-1/4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function NoticeListCard({
  notices,
  hasError = false,
  className,
}: NoticeListCardProps) {
  return (
    <Card className={cn("rounded-3xl border-0 shadow-sm", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-700" />
            <CardTitle className="text-xl">お知らせ</CardTitle>
          </div>
          <Badge variant="outline" className="rounded-full">
            {hasError ? "取得失敗" : `${notices.length}件`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasError ? (
          <article className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <h3 className="font-semibold text-rose-900">
              お知らせを取得できませんでした
            </h3>
            <p className="mt-2 text-sm leading-6 text-rose-700">
              時間をおいて再読み込みしてください。
            </p>
          </article>
        ) : (
          <>
            {notices.length === 0 ? (
              <article className="rounded-2xl border border-slate-100 p-4">
                <p className="text-sm leading-6 text-slate-600">
                  公開中のお知らせはありません。
                </p>
              </article>
            ) : (
              notices.map((notice, index) => (
                <article
                  key={notice.id}
                  className="rounded-2xl border border-slate-100 p-4 transition hover:bg-slate-50"
                >
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-semibold text-slate-900">
                      {index + 1}. {notice.title}
                    </h3>
                    <span className="text-sm text-slate-500">
                      {notice.date}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
                    {notice.body}
                    {notice.linkUrl ? (
                      <>
                        {" "}
                        <a
                          href={notice.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-900 underline underline-offset-4"
                        >
                          こちら
                        </a>
                      </>
                    ) : null}
                  </p>
                </article>
              ))
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
