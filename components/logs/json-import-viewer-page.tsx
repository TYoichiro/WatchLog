"use client";

import { useState } from "react";

import {
  OnliveLogViewerPage,
  type OnliveLogViewerData,
} from "@/components/onlive/onlive-room-page";
import { readJsonViewerLog, type JsonViewerLog } from "@/lib/onlive-local-log";

function toViewerData(stored: JsonViewerLog): OnliveLogViewerData {
  return {
    capturedAt: stored.capturedAt,
    createdAt: stored.capturedAt,
    id: `json-import:${stored.liveId}`,
    liveId: stored.liveId,
    liveStartedAt: null,
    log: stored.log,
    room: null,
    roomId: stored.roomId,
    updatedAt: stored.capturedAt,
  };
}

export function JsonImportViewerPage() {
  const [stored] = useState<JsonViewerLog | null>(() => readJsonViewerLog());

  if (!stored) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500">
        JSONログが見つかりませんでした。ログ一覧からJSONファイルを選択してください。
      </div>
    );
  }

  return <OnliveLogViewerPage data={toViewerData(stored)} />;
}
