"use client";

import { useState, useTransition } from "react";
import { useNavigationRouter as useRouter } from "@/components/navigation/navigation-progress";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function GenerateInvitationCodeButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/invitations", { method: "POST" });
        if (!res.ok) {
          throw new Error("招待コードの生成に失敗しました");
        }
        startTransition(() => router.refresh());
      } catch (e) {
        setError(e instanceof Error ? e.message : "招待コードの生成に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        {isPending ? "生成中..." : "招待コード生成"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
