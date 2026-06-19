import { toJstIsoString } from "@/lib/jst";

export type OnliveLocalLog = {
  capturedAt: string;
  commentCount: number;
  giftCount: number;
  liveId: string;
  log: Record<string, unknown>;
  roomId: string;
  roomName: string | null;
  savedAt: string;
};

const LOCAL_LOG_KEY_PREFIX = "watchlog:saved-log";

export function getOnliveLocalLogKey(roomId: string | number): string {
  return `${LOCAL_LOG_KEY_PREFIX}:${roomId}`;
}

export function readOnliveLocalLog(roomId: string | number): OnliveLocalLog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getOnliveLocalLogKey(roomId));
    if (!raw) return null;
    return JSON.parse(raw) as OnliveLocalLog;
  } catch {
    return null;
  }
}

export function writeOnliveLocalLog(roomId: string | number, log: OnliveLocalLog): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getOnliveLocalLogKey(roomId), JSON.stringify(log));
  } catch {
    // ignore storage errors
  }
}

export function deleteOnliveLocalLog(roomId: string | number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getOnliveLocalLogKey(roomId));
  } catch {
    // ignore storage errors
  }
}

export type JsonViewerLog = {
  capturedAt: string;
  liveId: string;
  log: Record<string, unknown>;
  roomId: string;
};

const JSON_VIEWER_KEY = "watchlog:json-viewer";

export function readJsonViewerLog(): JsonViewerLog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(JSON_VIEWER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as JsonViewerLog;
  } catch {
    return null;
  }
}

export function writeJsonViewerLog(log: JsonViewerLog): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(JSON_VIEWER_KEY, JSON.stringify(log));
  } catch {
    // ignore storage errors
  }
}

export function isValidJsonViewerLog(value: unknown): value is JsonViewerLog {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.capturedAt === "string" &&
    typeof v.liveId === "string" &&
    typeof v.roomId === "string" &&
    typeof v.log === "object" &&
    v.log !== null
  );
}

type RescueSnapshot = {
  version: 1;
  roomId: number;
  liveId: string;
  savedAt: number;
  comments: unknown[];
  gifts: unknown[];
  metrics: unknown;
};

export function isRescueSnapshot(value: unknown): value is RescueSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.roomId === "number" &&
    typeof v.liveId === "string" &&
    v.liveId.trim().length > 0 &&
    Array.isArray(v.comments) &&
    Array.isArray(v.gifts) &&
    typeof v.savedAt === "number"
  );
}

export function rescueSnapshotToJsonViewerLog(snapshot: RescueSnapshot): JsonViewerLog {
  const capturedAt = toJstIsoString(new Date(snapshot.savedAt));
  return {
    capturedAt,
    liveId: snapshot.liveId,
    roomId: String(snapshot.roomId),
    log: {
      capturedAt,
      comments: snapshot.comments,
      gifts: snapshot.gifts,
      liveInfo: {
        endedAt: null,
        liveId: snapshot.liveId,
        liveStatus: null,
        startedAt: null,
        telop: null,
      },
      metrics: snapshot.metrics,
      rankings: { live: [] },
      roomProfile: null,
      roomId: snapshot.roomId,
      savedAt: capturedAt,
      source: "rescue",
      version: 1,
    },
  };
}
