"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronRight,
  Gift,
  Loader2,
  MessageSquareText,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type LogListItem = {
  capturedAt: string;
  commentCount: number;
  createdAt: string;
  giftCount: number;
  id: string;
  liveId: string;
  liveRankingCount: number;
  roomId: string;
  roomName: string | null;
  totalRankingCount: number;
  updatedAt: string;
};

type ErrorResponse = {
  error?: string;
};

type LogListPageProps = {
  initialLogs: LogListItem[];
};

function formatLogDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ErrorResponse;
    return data.error || "ログの削除に失敗しました";
  } catch {
    return "ログの削除に失敗しました";
  }
}

export function LogListPage({ initialLogs }: LogListPageProps) {
  const router = useRouter();
  const [logs, setLogs] = useState(() => initialLogs);
  const [pendingDeleteLog, setPendingDeleteLog] = useState<LogListItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
    null
  );

  const handleConfirmDelete = async () => {
    if (!pendingDeleteLog) {
      return;
    }

    setIsDeleting(true);
    setDeleteErrorMessage(null);

    try {
      const response = await fetch(
        `/api/onlive/logs/${encodeURIComponent(pendingDeleteLog.id)}`,
        {
          method: "DELETE",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setLogs((current) =>
        current.filter((log) => log.id !== pendingDeleteLog.id)
      );
      setPendingDeleteLog(null);
      router.refresh();
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof Error ? error.message : "ログの削除に失敗しました"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <section className="shrink-0">
        <h1 className="text-xl font-semibold text-slate-950">
          ログ一覧{" "}
          <span className="font-normal text-slate-500">{logs.length}件</span>
        </h1>
      </section>

      {logs.length === 0 ? (
        <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardContent className="p-8 text-sm text-slate-600">
            保存済みログはまだありません。配信終了時にログが保存されます。
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          {logs.map((log) => (
            <div
              key={log.id}
              className="grid gap-3 border-b border-slate-100 p-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="font-semibold text-slate-950">
                    {formatLogDate(log.capturedAt)}
                  </span>
                  <Badge variant="outline">Live ID: {log.liveId}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1">
                    <MessageSquareText className="h-3.5 w-3.5" />
                    コメント {log.commentCount}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1">
                    <Gift className="h-3.5 w-3.5" />
                    ギフト {log.giftCount}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/logs/${log.id}`}>
                    閲覧
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteErrorMessage(null);
                    setPendingDeleteLog(log);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  削除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={pendingDeleteLog !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDeleteLog(null);
            setDeleteErrorMessage(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>ログを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDeleteLog
              ? `${formatLogDate(pendingDeleteLog.capturedAt)} のログを削除します。`
              : "ログを削除します。"}
          </AlertDialogDescription>
          {deleteErrorMessage ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
              {deleteErrorMessage}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>いいえ</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              はい
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
