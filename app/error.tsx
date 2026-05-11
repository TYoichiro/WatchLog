"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Error() {
  const handleReload = () => {
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
          <Button type="button" onClick={handleReload}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
