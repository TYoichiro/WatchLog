"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Error() {
  const [isReloading, setIsReloading] = useState(false);
  const handleReload = () => {
    if (isReloading) return;
    setIsReloading(true);
    window.location.reload();
  };

  return (
    <Dialog open>
      <DialogContent
        className="max-w-sm"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogTitle>エラーが発生しました</DialogTitle>
        <DialogDescription>再読み込みを行います。</DialogDescription>
        <DialogFooter>
          <Button type="button" onClick={handleReload} disabled={isReloading} aria-busy={isReloading}>
            {isReloading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {isReloading ? "再読み込み中..." : "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
