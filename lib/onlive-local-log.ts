export type OnliveLocalLog = {
  capturedAt: string;
  commentCount: number;
  giftCount: number;
  liveId: string;
  liveRankingCount: number;
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
