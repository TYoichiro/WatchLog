"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function GenerateInvitationCodeButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    try {
      const res = await fetch("/api/invitations", { method: "POST" });
      if (!res.ok) {
        throw new Error("招待コードの生成に失敗しました");
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      <Plus />
      招待コード生成
    </Button>
  );
}
