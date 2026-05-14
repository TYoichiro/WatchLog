"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type NoticeItem = {
  id: number;
  title: string;
  content: string;
  displayTarget: "AUTHENTICATED" | "LOGIN" | "ALL";
  publishedAt: string;
  expiresAt: string | null;
  linkUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormValues = {
  title: string;
  content: string;
  displayTarget: "AUTHENTICATED" | "LOGIN" | "ALL";
  publishedAt: string;
  expiresAt: string;
  linkUrl: string;
};

const DEFAULT_FORM: FormValues = {
  title: "",
  content: "",
  displayTarget: "AUTHENTICATED",
  publishedAt: "",
  expiresAt: "",
  linkUrl: "",
};

const DISPLAY_TARGET_LABELS: Record<NoticeItem["displayTarget"], string> = {
  AUTHENTICATED: "ログイン後",
  LOGIN: "ログイン画面",
  ALL: "全員",
};

const DISPLAY_TARGET_CLASSES: Record<NoticeItem["displayTarget"], string> = {
  AUTHENTICATED:
    "inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700",
  LOGIN:
    "inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700",
  ALL: "inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700",
};

type NoticeStatus = "publishing" | "scheduled" | "expired";

function getNoticeStatus(notice: NoticeItem): NoticeStatus {
  const now = new Date();
  const publishedAt = new Date(notice.publishedAt);
  if (now < publishedAt) return "scheduled";
  if (notice.expiresAt !== null && now >= new Date(notice.expiresAt))
    return "expired";
  return "publishing";
}

const STATUS_LABELS: Record<NoticeStatus, string> = {
  publishing: "公開中",
  scheduled: "公開予定",
  expired: "期限切れ",
};

const STATUS_CLASSES: Record<NoticeStatus, string> = {
  publishing:
    "inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700",
  scheduled:
    "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700",
  expired:
    "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500",
};

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function toDatetimeLocalValue(isoString: string): string {
  return isoString.slice(0, 16);
}

export function NoticesPage({
  initialNotices,
}: {
  initialNotices: NoticeItem[];
}) {
  const [notices, setNotices] = useState<NoticeItem[]>(initialNotices);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoticeItem | null>(null);
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreateDialog() {
    setEditingNotice(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(notice: NoticeItem) {
    setEditingNotice(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      displayTarget: notice.displayTarget,
      publishedAt: toDatetimeLocalValue(notice.publishedAt),
      expiresAt: notice.expiresAt ? toDatetimeLocalValue(notice.expiresAt) : "",
      linkUrl: notice.linkUrl ?? "",
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingNotice(null);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      try {
        const body = {
          title: form.title.trim(),
          content: form.content.trim(),
          displayTarget: form.displayTarget,
          publishedAt: form.publishedAt,
          expiresAt: form.expiresAt.trim() || null,
          linkUrl: form.linkUrl.trim() || null,
        };

        const url = editingNotice
          ? `/api/admin/notices/${editingNotice.id}`
          : "/api/admin/notices";
        const method = editingNotice ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as {
          notice?: NoticeItem;
          error?: string;
        };

        if (!res.ok) {
          setFormError(data.error ?? "エラーが発生しました");
          return;
        }

        if (!data.notice) {
          setFormError("予期しないレスポンスです");
          return;
        }

        if (editingNotice) {
          setNotices((prev) =>
            prev.map((n) => (n.id === editingNotice.id ? data.notice! : n)),
          );
        } else {
          setNotices((prev) => [data.notice!, ...prev]);
        }

        closeDialog();
      } catch {
        setFormError("通信エラーが発生しました");
      }
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/notices/${target.id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          alert(data.error ?? "削除に失敗しました");
          return;
        }

        setNotices((prev) => prev.filter((n) => n.id !== target.id));
      } catch {
        alert("通信エラーが発生しました");
      }
    });
  }

  return (
    <>
      <section className="flex shrink-0 items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-950">
          お知らせ管理{" "}
          <span className="font-normal text-slate-500">{notices.length}件</span>
        </h1>
        <Button
          type="button"
          onClick={openCreateDialog}
          className="gap-2 rounded-xl"
          disabled={isPending}
        >
          <Plus className="h-4 w-4" aria-hidden />
          新規作成
        </Button>
      </section>

      {notices.length === 0 ? (
        <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardContent className="p-8 text-sm text-slate-600">
            お知らせがありません。
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          {notices.map((notice) => {
            const status = getNoticeStatus(notice);
            return (
              <div
                key={notice.id}
                className="border-b border-slate-100 p-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={STATUS_CLASSES[status]}>
                        {STATUS_LABELS[status]}
                      </span>
                      <span className={DISPLAY_TARGET_CLASSES[notice.displayTarget]}>
                        {DISPLAY_TARGET_LABELS[notice.displayTarget]}
                      </span>
                      <p className="font-semibold text-slate-950">
                        {notice.title}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      公開: {formatDateTime(notice.publishedAt)}
                      {notice.expiresAt
                        ? ` 〜 ${formatDateTime(notice.expiresAt)}`
                        : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {notice.content}
                    </p>
                    {notice.linkUrl ? (
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {notice.linkUrl}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => openEditDialog(notice)}
                      disabled={isPending}
                      aria-label="編集"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setDeleteTarget(notice)}
                      disabled={isPending}
                      aria-label="削除"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="w-full max-w-lg" aria-describedby={undefined}>
          <DialogTitle>
            {editingNotice ? "お知らせを編集" : "お知らせを作成"}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label
                  htmlFor="notice-title"
                  className="text-sm font-medium text-slate-700"
                >
                  タイトル <span className="text-red-500">*</span>
                </label>
                <Input
                  id="notice-title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="お知らせタイトル"
                  required
                  disabled={isPending}
                  className="h-9"
                />
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="notice-content"
                  className="text-sm font-medium text-slate-700"
                >
                  本文 <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="notice-content"
                  value={form.content}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="お知らせの内容を入力してください"
                  rows={4}
                  required
                  disabled={isPending}
                  className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="notice-display-target"
                  className="text-sm font-medium text-slate-700"
                >
                  表示対象 <span className="text-red-500">*</span>
                </label>
                <select
                  id="notice-display-target"
                  value={form.displayTarget}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      displayTarget: e.target.value as FormValues["displayTarget"],
                    }))
                  }
                  disabled={isPending}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="AUTHENTICATED">ログイン後のユーザー</option>
                  <option value="LOGIN">ログイン画面のユーザー</option>
                  <option value="ALL">全員</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="notice-published-at"
                    className="text-sm font-medium text-slate-700"
                  >
                    公開日時 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="notice-published-at"
                    type="datetime-local"
                    value={form.publishedAt}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        publishedAt: e.target.value,
                      }))
                    }
                    required
                    disabled={isPending}
                    className="h-9"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label
                    htmlFor="notice-expires-at"
                    className="text-sm font-medium text-slate-700"
                  >
                    終了日時（任意）
                  </label>
                  <Input
                    id="notice-expires-at"
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        expiresAt: e.target.value,
                      }))
                    }
                    disabled={isPending}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="notice-link-url"
                  className="text-sm font-medium text-slate-700"
                >
                  リンクURL（任意）
                </label>
                <Input
                  id="notice-link-url"
                  type="url"
                  value={form.linkUrl}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, linkUrl: e.target.value }))
                  }
                  placeholder="https://example.com"
                  disabled={isPending}
                  className="h-9"
                />
              </div>

              {formError ? (
                <p className="text-sm text-red-600">{formError}</p>
              ) : null}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isPending}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "保存中..." : editingNotice ? "更新" : "作成"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>お知らせを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}
              」を削除しますか？この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isPending}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
