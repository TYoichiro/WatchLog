import { ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function RoleCard({ roleLabel }: { roleLabel: string }) {
  return (
    <Card className="rounded-lg border-slate-200 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-slate-950">権限</h2>
        </div>
        <p className="mt-4 text-sm text-slate-700">
          あなたは<span className="font-semibold">{roleLabel}</span>ユーザーです
        </p>
      </CardContent>
    </Card>
  );
}
