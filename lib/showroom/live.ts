import { toJstWallTimeDate } from "@/lib/jst";

import {
  SHOWROOM_API_URL,
  fetchShowroomJson,
  toFiniteNumber,
} from "./core";

type ShowroomCommentLogItem = {
  avatar_id?: number | null;
  avatar_url?: string | null;
  class_level?: number | string | null;
  comment?: string | null;
  create_at?: number | string | null;
  created_at?: number | string | null;
  name?: string | null;
  user_id?: number | string | null;
};

type ShowroomCommentLogResponse = {
  comment_log: ShowroomCommentLogItem[];
};

type ShowroomTelopResponse = {
  telop?: string | null;
};

type ShowroomLiveInfoResponse = {
  bcsvr_key?: string | null;
  live_id?: number | string | null;
  live_status?: number | string | null;
  redirect_url?: string | null;
};

function toCommentCreatedAt(
  value: ShowroomCommentLogItem["create_at"]
): number | null {
  return toFiniteNumber(value);
}

export type RoomComment = {
  id: string;
  avatarId: number | null;
  avatarUrl: string | null;
  classLevel: number | null;
  createdAt: number | null;
  name: string;
  text: string;
  userId: string | null;
};

export type RoomLiveInfo = {
  bcsvrKey: string | null;
  isPremiumLive: boolean;
  liveId: string | null;
  liveStatus: number | null;
};

export async function getRoomCommentLog(
  roomId: number | string
): Promise<RoomComment[]> {
  const url = new URL(SHOWROOM_API_URL.commentLog);
  url.searchParams.set("room_id", String(roomId));

  const rawData = await fetchShowroomJson<ShowroomCommentLogResponse>(url);

  return rawData.comment_log.map((item, index) => ({
    id: `${item.user_id ?? "guest"}-${item.create_at ?? item.created_at ?? index}`,
    avatarId:
      typeof item.avatar_id === "number" ? item.avatar_id : null,
    avatarUrl: item.avatar_url ?? null,
    classLevel: toFiniteNumber(item.class_level),
    createdAt: toCommentCreatedAt(item.create_at ?? item.created_at),
    name: item.name?.trim() || "Unknown",
    text: item.comment?.trim() || "",
    userId:
      item.user_id === null || item.user_id === undefined
        ? null
        : String(item.user_id),
  }));
}

export async function getRoomTelop(
  roomId: number | string
): Promise<string | null> {
  const url = new URL(SHOWROOM_API_URL.telop);
  url.searchParams.set("room_id", String(roomId));

  const rawData = await fetchShowroomJson<ShowroomTelopResponse>(url);
  const telop = rawData.telop?.trim();

  return telop && telop.length > 0 ? telop : null;
}

export async function getRoomLiveInfo(
  roomId: number | string
): Promise<RoomLiveInfo> {
  const url = new URL(SHOWROOM_API_URL.liveInfo);
  url.searchParams.set("room_id", String(roomId));

  const rawData = await fetchShowroomJson<ShowroomLiveInfoResponse>(url);
  const isPremiumLive = !!(rawData.redirect_url?.trim());
  const bcsvrKey = isPremiumLive ? null : (rawData.bcsvr_key?.trim() || null);

  const jstNow = toJstWallTimeDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateFallback = `${jstNow.getUTCFullYear()}${pad(jstNow.getUTCMonth() + 1)}${pad(jstNow.getUTCDate())}`;

  return {
    bcsvrKey,
    isPremiumLive,
    liveId:
      rawData.live_id !== null && rawData.live_id !== undefined
        ? String(rawData.live_id)
        : isPremiumLive
        ? dateFallback
        : null,
    liveStatus: isPremiumLive ? null : toFiniteNumber(rawData.live_status),
  };
}
