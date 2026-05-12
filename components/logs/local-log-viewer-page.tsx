"use client";

import { useRef, useSyncExternalStore } from "react";

import { getOnliveLocalLogKey, type OnliveLocalLog } from "@/lib/onlive-local-log";
import {
  OnliveLogViewerPage,
  type OnliveLogViewerData,
} from "@/components/onlive/onlive-room-page";

type Props = {
  roomId: string;
};

type SnapshotCache = { raw: string | null | undefined; log: OnliveLocalLog | null };

function toViewerData(localLog: OnliveLocalLog): OnliveLogViewerData {
  return {
    capturedAt: localLog.capturedAt,
    createdAt: localLog.savedAt,
    id: `local:${localLog.liveId}`,
    liveId: localLog.liveId,
    liveStartedAt: null,
    log: localLog.log,
    room: null,
    roomId: localLog.roomId,
    updatedAt: localLog.savedAt,
  };
}

export function LocalLogViewerPage({ roomId }: Props) {
  const cacheRef = useRef<SnapshotCache>({ raw: undefined, log: null });

  const localLog = useSyncExternalStore(
    () => () => {},
    () => {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(getOnliveLocalLogKey(roomId));
      if (raw === cacheRef.current.raw) return cacheRef.current.log;
      const log = raw ? (JSON.parse(raw) as OnliveLocalLog) : null;
      cacheRef.current = { raw, log };
      return log;
    },
    () => null
  );

  if (!localLog) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500">
        ローカルのログが見つかりませんでした。
      </div>
    );
  }

  return <OnliveLogViewerPage data={toViewerData(localLog)} />;
}
