"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

const ONLIVE_STORAGE_KEY_PREFIX = "watchlog:onlive:";
const ONLIVE_STORAGE_VERSION = 1;

type RawSnapshot = {
  comments: unknown[];
  gifts: unknown[];
  liveId: string;
  metrics: unknown;
  roomId: number;
  savedAt: number;
  version: 1;
};

type RescueEntry = {
  key: string;
  snapshot: RawSnapshot;
};

type EntryStatus =
  | { kind: "idle" }
  | { kind: "success" }
  | { kind: "error"; message: string };

type EntryState = {
  entry: RescueEntry;
  status: EntryStatus;
};

function isValidSnapshot(value: unknown): value is RawSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === ONLIVE_STORAGE_VERSION &&
    typeof v.roomId === "number" &&
    typeof v.liveId === "string" &&
    v.liveId.trim().length > 0 &&
    Array.isArray(v.comments) &&
    Array.isArray(v.gifts) &&
    typeof v.savedAt === "number"
  );
}

function scanOnliveSnapshots(): RescueEntry[] {
  const entries: RescueEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(ONLIVE_STORAGE_KEY_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidSnapshot(parsed)) continue;
      entries.push({ key, snapshot: parsed });
    } catch {
      // ignore unparseable entries
    }
  }
  return entries;
}

function toJstWallTimeString(unixMs: number): string {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const d = new Date(unixMs + JST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  const p3 = (n: number) => String(n).padStart(3, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p3(d.getUTCMilliseconds())}+09:00`;
}

function toJstDisplayString(unixMs: number): string {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const d = new Date(unixMs + JST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

async function recoverEntry(entry: RescueEntry): Promise<void> {
  const { snapshot } = entry;

  const log = {
    capturedAt: toJstWallTimeString(snapshot.savedAt),
    comments: snapshot.comments,
    gifts: snapshot.gifts,
    liveInfo: {
      endedAt: null,
      liveId: snapshot.liveId,
      liveStatus: null,
      startedAt: null,
      telop: null,
    },
    localStorageSnapshot: snapshot,
    metrics: snapshot.metrics,
    rankings: { live: [] },
    roomProfile: null,
    roomId: snapshot.roomId,
    savedAt: toJstWallTimeString(Date.now()),
    source: "rescue",
    version: 1,
  };

  const response = await fetch("/api/onlive/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      capturedAt: snapshot.savedAt,
      liveId: snapshot.liveId,
      log,
      roomId: String(snapshot.roomId),
    }),
  });

  if (!response.ok) {
    let message = `エラー (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  localStorage.removeItem(entry.key);
}

function downloadSnapshot(entry: RescueEntry): void {
  const { snapshot } = entry;
  const raw = localStorage.getItem(entry.key);
  const content = raw ?? JSON.stringify(snapshot);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `watchlog-rescue-${snapshot.roomId}-${snapshot.liveId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RescuePage() {
  const [entryStates, setEntryStates] = useState<EntryState[]>(() =>
    scanOnliveSnapshots().map((entry) => ({
      entry,
      status: { kind: "idle" as const },
    }))
  );
  const [isPending, startTransition] = useTransition();

  const handleDeleteEntry = (key: string) => {
    localStorage.removeItem(key);
    setEntryStates((prev) => prev.filter((s) => s.entry.key !== key));
  };

  const handleRecoverAll = () => {
    const idleIndices = entryStates
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.status.kind === "idle")
      .map(({ i }) => i);

    startTransition(async () => {
      for (const index of idleIndices) {
        try {
          await recoverEntry(entryStates[index].entry);
          setEntryStates((prev) =>
            prev.map((s, i) =>
              i === index ? { ...s, status: { kind: "success" as const } } : s
            )
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "不明なエラー";
          setEntryStates((prev) =>
            prev.map((s, i) =>
              i === index
                ? { ...s, status: { kind: "error" as const, message } }
                : s
            )
          );
        }
      }
    });
  };

  if (entryStates.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h2 className="text-lg font-semibold text-slate-800">ログレスキュー</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          ローカルストレージにログが見つかりませんでした
        </div>
      </div>
    );
  }

  const hasIdle = entryStates.some((s) => s.status.kind === "idle");

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h2 className="text-lg font-semibold text-slate-800">ログレスキュー</h2>
      <p className="text-sm text-slate-600">
        {entryStates.length}件のログが見つかりました
      </p>

      <div className="flex gap-3">
        {hasIdle && (
          <Button
            type="button"
            onClick={handleRecoverAll}
            disabled={isPending}
            className="flex-1 cursor-pointer"
          >
            {isPending ? "復旧中..." : "復旧する"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            for (const state of entryStates) {
              downloadSnapshot(state.entry);
            }
          }}
          disabled={isPending}
          className={`cursor-pointer${hasIdle ? "" : " w-full"}`}
        >
          ダウンロード
        </Button>
      </div>

      <div className="space-y-3">
        {entryStates.map((state) => {
          const { snapshot } = state.entry;
          return (
            <div
              key={state.entry.key}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-500">ルームID</span>
                <span className="font-mono text-slate-800">{snapshot.roomId}</span>
                <span className="text-slate-500">ライブID</span>
                <span className="font-mono text-slate-800">{snapshot.liveId}</span>
                <span className="text-slate-500">コメント数</span>
                <span className="text-slate-800">{snapshot.comments.length}件</span>
                <span className="text-slate-500">ギフト数</span>
                <span className="text-slate-800">{snapshot.gifts.length}件</span>
                <span className="text-slate-500">最終更新</span>
                <span className="text-slate-800">{toJstDisplayString(snapshot.savedAt)}</span>
              </div>
              {state.status.kind === "success" && (
                <p className="text-sm font-medium text-emerald-600">保存しました</p>
              )}
              {state.status.kind === "error" && (
                <p className="text-sm font-medium text-red-600">
                  エラー: {state.status.message}
                </p>
              )}
              {(state.status.kind === "idle" || state.status.kind === "error") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteEntry(state.entry.key)}
                  disabled={isPending}
                  className="cursor-pointer text-red-600 border-red-200 hover:bg-red-50"
                >
                  削除
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
