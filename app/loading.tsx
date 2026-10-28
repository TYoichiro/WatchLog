import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-700">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-sm">
        <Loader2 className="size-8 animate-spin motion-reduce:animate-none text-slate-500" aria-hidden />
        <p>ページを読み込み中...</p>
      </div>
    </main>
  );
}
