"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronRight,
  Download,
  FileJson,
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
import {
  deleteOnliveLocalLog,
  isValidJsonViewerLog,
  readOnliveLocalLog,
  writeJsonViewerLog,
  type OnliveLocalLog,
} from "@/lib/onlive-local-log";

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

type LogDownloadPayload = {
  capturedAt: string;
  liveId: string;
  log: Record<string, unknown>;
  roomId: string;
};

type LogListPageProps = {
  initialLogs: LogListItem[];
  isPremium?: boolean;
  roomId?: string;
};

function localLogToListItem(log: OnliveLocalLog): LogListItem {
  return {
    capturedAt: log.capturedAt,
    commentCount: log.commentCount,
    createdAt: log.savedAt,
    giftCount: log.giftCount,
    id: `local:${log.roomId}`,
    liveId: log.liveId,
    liveRankingCount: log.liveRankingCount,
    roomId: log.roomId,
    roomName: log.roomName,
    totalRankingCount: 0,
    updatedAt: log.savedAt,
  };
}

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

function getDownloadFilename(log: LogListItem): string {
  const date = new Date(log.capturedAt);
  const dateStr = Number.isNaN(date.getTime())
    ? "unknown"
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `watchlog-${log.liveId}-${dateStr}.json`;
}

function triggerJsonDownload(filename: string, data: LogDownloadPayload): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LogListPage({ initialLogs, isPremium = true, roomId }: LogListPageProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<LogListItem[]>(() => {
    if (!isPremium && roomId) {
      const localLog = readOnliveLocalLog(roomId);
      if (localLog) return [localLogToListItem(localLog)];
    }
    return initialLogs;
  });
  const [pendingDeleteLog, setPendingDeleteLog] = useState<LogListItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
    null
  );
  const [downloadingLogId, setDownloadingLogId] = useState<string | null>(null);
  const [jsonImportError, setJsonImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!event.target) return;
    event.target.value = "";
    if (!file) return;

    setJsonImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed: unknown = JSON.parse(e.target?.result as string);
        if (!isValidJsonViewerLog(parsed)) {
          setJsonImportError("正しい形式のWatchLog JSONファイルではありません。");
          return;
        }
        writeJsonViewerLog(parsed);
        router.push("/logs/json-import");
      } catch {
        setJsonImportError("JSONファイルの読み込みに失敗しました。");
      }
    };
    reader.onerror = () => {
      setJsonImportError("ファイルの読み込みに失敗しました。");
    };
    reader.readAsText(file);
  };

  const handleDownload = async (log: LogListItem) => {
    setDownloadingLogId(log.id);
    try {
      if (!isPremium && roomId) {
        const localLog = readOnliveLocalLog(roomId);
        if (localLog) {
          triggerJsonDownload(getDownloadFilename(log), {
            capturedAt: localLog.capturedAt,
            liveId: localLog.liveId,
            log: localLog.log,
            roomId: localLog.roomId,
          });
        }
        return;
      }

      const response = await fetch(
        `/api/onlive/logs/${encodeURIComponent(log.id)}`,
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const data = (await response.json()) as LogDownloadPayload;
      triggerJsonDownload(getDownloadFilename(log), data);
    } catch {
      // download errors are silently ignored
    } finally {
      setDownloadingLogId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteLog) {
      return;
    }

    if (!isPremium) {
      if (roomId) deleteOnliveLocalLog(roomId);
      setLogs([]);
      setPendingDeleteLog(null);
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

      <Card className="shrink-0 rounded-lg border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <FileJson className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">JSONログ閲覧</p>
              <p className="text-xs text-slate-500">
                ダウンロードしたJSONファイルを選択してログを閲覧できます
              </p>
              <p className="text-xs text-slate-500">
                （旧バージョン（v2.X.X系）の互換性はありません）
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setJsonImportError(null);
                fileInputRef.current?.click();
              }}
            >
              JSONを選択
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleJsonFileChange}
            />
          </div>
          {jsonImportError ? (
            <p className="mt-3 text-xs text-rose-600">{jsonImportError}</p>
          ) : null}
        </CardContent>
      </Card>

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
                  <Link href={log.id.startsWith("local:") ? `/logs/local/${log.roomId}` : `/logs/${encodeURIComponent(log.id)}`}>
                    閲覧
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={downloadingLogId === log.id}
                  onClick={() => void handleDownload(log)}
                >
                  {downloadingLogId === log.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  )}
                  ダウンロード
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
