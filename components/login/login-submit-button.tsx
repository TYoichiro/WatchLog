"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LoginSubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="h-12 cursor-pointer w-full rounded-2xl border-slate-200 bg-white text-base font-semibold hover:bg-slate-50"
      disabled={pending}
      aria-busy={pending}
      aria-live="polite"
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ログイン中...
        </>
      ) : children}
    </Button>
  );
}
