"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export function LiveSettingsModal({
  showNotice,
  onShowNoticeChange,
}: {
  showNotice: boolean;
  onShowNoticeChange: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="cursor-pointer rounded-xl text-slate-500 hover:text-slate-700"
        onClick={() => setOpen(true)}
        aria-label="設定"
      >
        <Settings className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogTitle>設定</DialogTitle>
          <div className="space-y-5">
            <section className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">コメント設定</p>
              <SettingRow
                label="お知らせ系通知"
                checked={showNotice}
                onCheckedChange={onShowNoticeChange}
              />
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SettingRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="cursor-pointer"
      />
    </div>
  );
}
