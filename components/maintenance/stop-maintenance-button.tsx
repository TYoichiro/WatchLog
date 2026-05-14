"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function StopMaintenanceButton({ windowId }: { windowId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStop() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/maintenance/${windowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isEnabled: false }),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "エラーが発生しました");
          return;
        }

        router.refresh();
        router.push("/");
      } catch {
        setError("通信エラーが発生しました");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-xs text-slate-500">管理者操作</p>
      <Button
        type="button"
        variant="destructive"
        onClick={handleStop}
        disabled={isPending}
        className="gap-2"
      >
        <ShieldOff className="h-4 w-4" aria-hidden />
        {isPending ? "停止中..." : "メンテナンスを停止"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
