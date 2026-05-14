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
import { Switch } from "@/components/ui/switch";

export type MaintenanceItem = {
  id: string;
  title: string;
  message: string | null;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormValues = {
  title: string;
  message: string;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
};

const DEFAULT_FORM: FormValues = {
  title: "システムメンテナンス",
  message: "",
  startsAt: "",
  endsAt: "",
  isEnabled: true,
};

function toDatetimeLocalValue(isoString: string): string {
  return isoString.slice(0, 16);
}

function getWindowStatus(
  window: MaintenanceItem,
): "active" | "upcoming" | "expired" | "disabled" {
  if (!window.isEnabled) return "disabled";
  const now = new Date();
  const startsAt = new Date(window.startsAt);
  const endsAt = new Date(window.endsAt);
  if (now >= endsAt) return "expired";
  if (now < startsAt) return "upcoming";
  return "active";
}

const STATUS_LABELS: Record<
  "active" | "upcoming" | "expired" | "disabled",
  string
> = {
  active: "アクティブ",
  upcoming: "予定",
  expired: "終了済み",
  disabled: "無効",
};

const STATUS_CLASSES: Record<
  "active" | "upcoming" | "expired" | "disabled",
  string
> = {
  active:
    "inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700",
  upcoming:
    "inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700",
  expired:
    "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600",
  disabled:
    "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700",
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

export function MaintenancePage({
  initialWindows,
}: {
  initialWindows: MaintenanceItem[];
}) {
  const [windows, setWindows] = useState<MaintenanceItem[]>(initialWindows);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWindow, setEditingWindow] = useState<MaintenanceItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceItem | null>(
    null,
  );
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreateDialog() {
    setEditingWindow(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(window: MaintenanceItem) {
    setEditingWindow(window);
    setForm({
      title: window.title,
      message: window.message ?? "",
      startsAt: toDatetimeLocalValue(window.startsAt),
      endsAt: toDatetimeLocalValue(window.endsAt),
      isEnabled: window.isEnabled,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingWindow(null);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      try {
        const body = {
          title: form.title.trim(),
          message: form.message.trim() || null,
          startsAt: form.startsAt,
          endsAt: form.endsAt,
          isEnabled: form.isEnabled,
        };

        const url = editingWindow
          ? `/api/admin/maintenance/${editingWindow.id}`
          : "/api/admin/maintenance";
        const method = editingWindow ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as {
          maintenanceWindow?: MaintenanceItem;
          error?: string;
        };

        if (!res.ok) {
          setFormError(data.error ?? "エラーが発生しました");
          return;
        }

        if (!data.maintenanceWindow) {
          setFormError("予期しないレスポンスです");
          return;
        }

        if (editingWindow) {
          setWindows((prev) =>
            prev.map((w) =>
              w.id === editingWindow.id ? data.maintenanceWindow! : w,
            ),
          );
        } else {
          setWindows((prev) => [data.maintenanceWindow!, ...prev]);
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
        const res = await fetch(`/api/admin/maintenance/${target.id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          alert(data.error ?? "削除に失敗しました");
          return;
        }

        setWindows((prev) => prev.filter((w) => w.id !== target.id));
      } catch {
        alert("通信エラーが発生しました");
      }
    });
  }

  return (
    <>
      <section className="flex shrink-0 items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-950">
          メンテナンス設定{" "}
          <span className="font-normal text-slate-500">{windows.length}件</span>
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

      {windows.length === 0 ? (
        <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardContent className="p-8 text-sm text-slate-600">
            メンテナンス設定がありません。
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          {windows.map((window) => {
            const status = getWindowStatus(window);
            return (
              <div
                key={window.id}
                className="border-b border-slate-100 p-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={STATUS_CLASSES[status]}>
                        {STATUS_LABELS[status]}
                      </span>
                      <p className="font-semibold text-slate-950">
                        {window.title}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDateTime(window.startsAt)}
                      {" 〜 "}
                      {formatDateTime(window.endsAt)}
                    </p>
                    {window.message ? (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {window.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => openEditDialog(window)}
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
                      onClick={() => setDeleteTarget(window)}
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
            {editingWindow ? "メンテナンス設定を編集" : "メンテナンス設定を作成"}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label
                  htmlFor="maint-title"
                  className="text-sm font-medium text-slate-700"
                >
                  タイトル <span className="text-red-500">*</span>
                </label>
                <Input
                  id="maint-title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="システムメンテナンス"
                  required
                  disabled={isPending}
                  className="h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="maint-starts-at"
                    className="text-sm font-medium text-slate-700"
                  >
                    開始日時 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="maint-starts-at"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        startsAt: e.target.value,
                      }))
                    }
                    required
                    disabled={isPending}
                    className="h-9"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label
                    htmlFor="maint-ends-at"
                    className="text-sm font-medium text-slate-700"
                  >
                    終了日時 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="maint-ends-at"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, endsAt: e.target.value }))
                    }
                    required
                    disabled={isPending}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="maint-message"
                  className="text-sm font-medium text-slate-700"
                >
                  メッセージ（任意）
                </label>
                <textarea
                  id="maint-message"
                  value={form.message}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                  placeholder="メンテナンス内容の説明を入力してください"
                  rows={4}
                  disabled={isPending}
                  className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="maint-is-enabled"
                  checked={form.isEnabled}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, isEnabled: checked }))
                  }
                  disabled={isPending}
                />
                <label
                  htmlFor="maint-is-enabled"
                  className="text-sm font-medium text-slate-700"
                >
                  有効にする
                </label>
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
                {isPending
                  ? "保存中..."
                  : editingWindow
                    ? "更新"
                    : "作成"}
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
            <AlertDialogTitle>メンテナンス設定を削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」を削除しますか？この操作は元に戻せません。
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
