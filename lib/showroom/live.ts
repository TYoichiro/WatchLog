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
  const bcsvrKey = rawData.bcsvr_key?.trim() || null;

  return {
    bcsvrKey,
    liveId:
      rawData.live_id === null || rawData.live_id === undefined
        ? null
        : String(rawData.live_id),
    liveStatus: toFiniteNumber(rawData.live_status),
  };
}
