"use client";

import { useRef, useState } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { useNavigationRouter as useRouter } from "@/components/navigation/navigation-progress";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  Gift,
  Heart,
  Loader2,
  MessageSquareText,
  Pencil,
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
import { cn } from "@/lib/utils";
import {
  deleteOnliveLocalLog,
  isRescueSnapshot,
  isValidJsonViewerLog,
  readOnliveLocalLog,
  rescueSnapshotToJsonViewerLog,
  writeJsonViewerLog,
  type OnliveLocalLog,
} from "@/lib/onlive-local-log";

export type LogListItem = {
  capturedAt: string;
  commentCount: number;
  createdAt: string;
  giftCount: number;
  id: string;
  isFavorite: boolean;
  liveId: string;
  roomId: string;
  roomName: string | null;
  title: string | null;
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
  isAdmin?: boolean;
  isPremium?: boolean;
  roomId?: string;
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function localLogToListItem(log: OnliveLocalLog): LogListItem {
  return {
    capturedAt: log.capturedAt,
    commentCount: log.commentCount,
    createdAt: log.savedAt,
    giftCount: log.giftCount,
    id: `local:${log.roomId}`,
    isFavorite: false,
    liveId: log.liveId,
    roomId: log.roomId,
    roomName: log.roomName,
    title: null,
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
  if (Number.isNaN(date.getTime())) return `watchlog-${log.liveId}-unknown.json`;
  const dateStr = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date).replace(/\//g, "");
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

function getLogHref(log: LogListItem): string {
  return log.id.startsWith("local:")
    ? `/logs/local/${log.roomId}`
    : `/logs/${encodeURIComponent(log.id)}`;
}

function buildPageNumbers(current: number, total: number): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [1];

  const rangeStart = Math.max(2, current - 1);
  const rangeEnd = Math.min(total - 1, current + 1);

  if (rangeStart > 2) pages.push("ellipsis-start");
  for (let p = rangeStart; p <= rangeEnd; p++) pages.push(p);
  if (rangeEnd < total - 1) pages.push("ellipsis-end");

  pages.push(total);
  return pages;
}

type PaginationControlsProps = {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
};

function PaginationControls({ currentPage, onPageChange, totalPages }: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="前のページ"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>
      {pages.map((page) =>
        typeof page === "string" ? (
          <span key={page} className="select-none px-2 text-slate-400">
            ...
          </span>
        ) : (
          <Button
            key={page}
            type="button"
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        )
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="次のページ"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

type JsonImportCardProps = {
  error: string | null;
  onClearError: () => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

function JsonImportCard({ error, onClearError, onFileChange }: JsonImportCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
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
              onClearError();
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
            onChange={onFileChange}
          />
        </div>
        {error ? (
          <p className="mt-3 text-xs text-rose-600">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

type LogRowProps = {
  canEdit: boolean;
  isDownloading: boolean;
  isFavoritePending: boolean;
  log: LogListItem;
  onDelete: () => void;
  onDownload: () => void;
  onFavoriteToggle: (logId: string) => void;
  onTitleSave: (logId: string, title: string | null) => void;
};

function LogRow({ canEdit, isDownloading, isFavoritePending, log, onDelete, onDownload, onFavoriteToggle, onTitleSave }: LogRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const cancelledRef = useRef(false);
  const isSavingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    if (isSavingRef.current) return;
    setSaveError(null);
    setEditTitle(log.title ?? "");
    cancelledRef.current = false;
    setIsEditing(true);
  };

  const saveTitle = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    setIsEditing(false);

    const newTitle = editTitle.trim() || null;
    try {
      const response = await fetch(`/api/onlive/logs/${encodeURIComponent(log.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("タイトルの保存に失敗しました");
      onTitleSave(log.id, newTitle);
    } catch {
      setSaveError("タイトルの保存に失敗しました。もう一度お試しください。");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const cancelEditing = () => {
    cancelledRef.current = true;
    setIsEditing(false);
    setEditTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  return (
    <div className="grid gap-3 border-b border-slate-100 p-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center last:border-b-0">
      <div className="flex items-start gap-3 min-w-0">
        {canEdit && (
          <button
            type="button"
            className="mt-0.5 shrink-0 text-slate-300 transition-colors hover:text-pink-400 disabled:cursor-wait disabled:opacity-60"
            onClick={() => onFavoriteToggle(log.id)}
            disabled={isFavoritePending}
            aria-busy={isFavoritePending}
            aria-label={isFavoritePending ? "お気に入りを更新中..." : log.isFavorite ? "お気に入りを解除" : "お気に入りに追加"}
          >
            {isFavoritePending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : <Heart
              className={cn(
                "h-5 w-5 transition-colors",
                log.isFavorite ? "fill-pink-500 text-pink-500" : "fill-none"
              )}
              aria-hidden
            />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => void saveTitle()}
                autoFocus
                placeholder={formatLogDate(log.capturedAt)}
                className="min-w-45 border-b border-slate-400 bg-transparent font-semibold text-slate-950 focus:border-slate-600 focus:outline-none"
              />
            ) : (
              <span className="font-semibold text-slate-950">
                {log.title ?? formatLogDate(log.capturedAt)}
              </span>
            )}
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={startEditing}
                disabled={isSaving}
                aria-busy={isSaving}
                aria-label="タイトルを編集"
                className="text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-wait"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : <Pencil className="h-3.5 w-3.5" aria-hidden />}
              </button>
            )}
            {isSaving ? <span role="status" className="text-xs text-slate-500">保存中...</span> : null}
            <Badge variant="outline">Live ID: {log.liveId}</Badge>
          </div>
          {saveError ? <p role="alert" className="mt-2 text-xs text-rose-600">{saveError}</p> : null}
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
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={getLogHref(log)}>
            閲覧
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDownloading}
          aria-busy={isDownloading}
          onClick={onDownload}
        >
          {isDownloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden />
          )}
          {isDownloading ? "ダウンロード中..." : "ダウンロード"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          削除
        </Button>
      </div>
    </div>
  );
}

type LogDeleteDialogProps = {
  errorMessage: string | null;
  isDeleting: boolean;
  log: LogListItem | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

function LogDeleteDialog({
  errorMessage,
  isDeleting,
  log,
  onConfirm,
  onOpenChange,
}: LogDeleteDialogProps) {
  return (
    <AlertDialog open={log !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>ログを削除しますか？</AlertDialogTitle>
        <AlertDialogDescription>
          {log
            ? `${log.title ?? formatLogDate(log.capturedAt)} のログを削除します。`
            : "ログを削除します。"}
        </AlertDialogDescription>
        {errorMessage ? (
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>いいえ</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            aria-busy={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {isDeleting ? "削除中..." : "はい"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LogListPage({ initialLogs, isAdmin = false, isPremium = true, roomId }: LogListPageProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<LogListItem[]>(() => {
    if (!isPremium && roomId) {
      const localLog = readOnliveLocalLog(roomId);
      if (localLog) return [localLogToListItem(localLog)];
    }
    return initialLogs;
  });
  const [pendingDeleteLog, setPendingDeleteLog] = useState<LogListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [downloadingLogIds, setDownloadingLogIds] = useState(new Set<string>());
  const downloadingLogIdsRef = useRef(new Set<string>());
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState(new Set<string>());
  const pendingFavoriteIdsRef = useRef(new Set<string>());
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [jsonImportError, setJsonImportError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);

  const canEdit = isPremium !== false;
  const canBulkDownload = isAdmin || isPremium !== false;

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const paginatedLogs = logs.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setJsonImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed: unknown = JSON.parse(e.target?.result as string);
        if (isValidJsonViewerLog(parsed)) {
          writeJsonViewerLog(parsed);
        } else if (isRescueSnapshot(parsed)) {
          writeJsonViewerLog(rescueSnapshotToJsonViewerLog(parsed));
        } else {
          setJsonImportError("正しい形式のWatchLog JSONファイルではありません。");
          return;
        }
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

  const handleFavoriteToggle = async (logId: string) => {
    if (pendingFavoriteIdsRef.current.has(logId)) return;
    pendingFavoriteIdsRef.current.add(logId);
    setPendingFavoriteIds(new Set(pendingFavoriteIdsRef.current));
    setLogs((current) =>
      current.map((log) =>
        log.id === logId ? { ...log, isFavorite: !log.isFavorite } : log
      )
    );

    try {
      const response = await fetch(
        `/api/onlive/logs/${encodeURIComponent(logId)}/favorite`,
        { method: "PUT", cache: "no-store" }
      );
      if (!response.ok) {
        setLogs((current) =>
          current.map((log) =>
            log.id === logId ? { ...log, isFavorite: !log.isFavorite } : log
          )
        );
      }
    } catch {
      setLogs((current) =>
        current.map((log) =>
          log.id === logId ? { ...log, isFavorite: !log.isFavorite } : log
        )
      );
    } finally {
      pendingFavoriteIdsRef.current.delete(logId);
      setPendingFavoriteIds(new Set(pendingFavoriteIdsRef.current));
    }
  };

  const handleTitleSave = (logId: string, title: string | null) => {
    setLogs((current) =>
      current.map((log) => (log.id === logId ? { ...log, title } : log))
    );
  };

  const handleDownload = async (log: LogListItem) => {
    if (downloadingLogIdsRef.current.has(log.id)) return;
    downloadingLogIdsRef.current.add(log.id);
    setDownloadingLogIds(new Set(downloadingLogIdsRef.current));
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
      downloadingLogIdsRef.current.delete(log.id);
      setDownloadingLogIds(new Set(downloadingLogIdsRef.current));
    }
  };

  const handleBulkDownload = async () => {
    if (isBulkDownloading) return;
    setIsBulkDownloading(true);
    try {
      const response = await fetch("/api/onlive/logs/bulk-download", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "watchlog-bulk.json";
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteLog || isDeleting) return;

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-950">
            ログ一覧{" "}
            <span className="font-normal text-slate-500">{logs.length}件</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {canBulkDownload && logs.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBulkDownloading}
                aria-busy={isBulkDownloading}
                onClick={() => void handleBulkDownload()}
              >
                {isBulkDownloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-3.5 w-3.5" aria-hidden />
                )}
                一括ダウンロード
              </Button>
            )}
            {logs.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <label htmlFor="page-size-select" className="shrink-0">
                  表示件数
                </label>
                <select
                  id="page-size-select"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value) as PageSize)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}件
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </section>

      <JsonImportCard
        error={jsonImportError}
        onClearError={() => setJsonImportError(null)}
        onFileChange={handleJsonFileChange}
      />

      {logs.length === 0 ? (
        <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardContent className="p-8 text-sm text-slate-600">
            保存済みログはまだありません。配信終了時にログが保存されます。
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white">
            {paginatedLogs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                canEdit={canEdit}
                isDownloading={downloadingLogIds.has(log.id)}
                isFavoritePending={pendingFavoriteIds.has(log.id)}
                onDownload={() => void handleDownload(log)}
                onDelete={() => {
                  setDeleteErrorMessage(null);
                  setPendingDeleteLog(log);
                }}
                onFavoriteToggle={(logId) => void handleFavoriteToggle(logId)}
                onTitleSave={handleTitleSave}
              />
            ))}
          </div>
          <PaginationControls
            currentPage={clampedPage}
            onPageChange={setCurrentPage}
            totalPages={totalPages}
          />
        </>
      )}

      <LogDeleteDialog
        log={pendingDeleteLog}
        isDeleting={isDeleting}
        errorMessage={deleteErrorMessage}
        onConfirm={() => void handleConfirmDelete()}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDeleteLog(null);
            setDeleteErrorMessage(null);
          }
        }}
      />
    </>
  );
}
