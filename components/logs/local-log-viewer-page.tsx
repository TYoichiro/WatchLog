"use client";

import { useSyncExternalStore } from "react";

import { readOnliveLocalLog, type OnliveLocalLog } from "@/lib/onlive-local-log";
import {
  OnliveLogViewerPage,
  type OnliveLogViewerData,
} from "@/components/onlive/onlive-room-page";

type Props = {
  roomId: string;
};

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
  const localLog = useSyncExternalStore(
    () => () => {},
    () => readOnliveLocalLog(roomId),
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
