"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function GenerateInvitationCodeButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations", { method: "POST" });
      if (!res.ok) {
        throw new Error("招待コードの生成に失敗しました");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待コードの生成に失敗しました");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        <Plus />
        招待コード生成
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
