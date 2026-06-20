import { toJstWallTimeDate } from "@/lib/jst";

import {
  SHOWROOM_API_URL,
  fetchShowroomJson,
  toFiniteNumber,
  toLargeImageUrl,
} from "./core";

type ShowroomRoomProfileResponse = {
  room_id: number;
  room_url_key: string;
  room_name: string;
  image: string;
  is_onlive: boolean;
  premium_room_type: number;
  follower_num: number;
  view_num?: number | string | null;
  genre_name: string;
  is_official: boolean;
  room_level: number;
  league_label: string;
  show_rank_subdivided: string;
  next_show_rank_subdivided: string;
  current_live_started_at: number | null;
};

type ShowroomRoomStatusResponse = {
  broadcast_host?: string | null;
  broadcast_key?: string | null;
  broadcast_port?: number | string | null;
  is_live?: boolean | null;
  live_status?: number | string | null;
  room_id?: number | string | null;
  room_url_key?: string | null;
};

type ShowroomEventAndSupportResponse = {
  event: {
    event_id: number;
    event_name: string;
    image: string;
    started_at: number;
    ended_at: number;
    event_url: string;
    ranking?: {
      rank: number;
      before_rank: number;
      point: number;
      gap: number;
    };
  } | null;
  support: {
    support_id: number;
    name: string;
  } | null;
};

type ShowroomActiveFanResponse = {
  fan_name: string;
  total_user_count: number;
};

const RANK_TIME_CHARGE_MAP: Record<string, string> = {
  "SS-5": "¥10,000",
  "SS-4": "¥6,600",
  "SS-3": "¥5,000",
  "SS-2": "¥4,300",
  "SS-1": "¥3,600",
  "S-5": "¥3,300",
  "S-4": "¥2,700",
  "S-3": "¥2,000",
  "S-2": "¥1,300",
  "S-1": "¥1,000",
  "A-5": "¥830",
  "A-4": "¥770",
  "A-3": "¥730",
  "A-2": "¥700",
  "A-1": "¥670",
  "B-5": "¥30",
};

function getTimeChargeByRank(rank: string): string | null {
  return RANK_TIME_CHARGE_MAP[rank] ?? null;
}

export type RoomProfile = {
  roomId: number;
  roomUrlKey: string;
  roomName: string;
  roomImageUrl: string;
  isOnlive: boolean;
  premiumRoomType: number;
  followerNum: string;
  viewNum: number | null;
  genreName: string;
  isOfficial: boolean;
  roomLevel: string;
  leagueLabel: string;
  showRankSubdivided: string;
  showRankTimeCharge: string | null;
  nextShowRankSubdivided: string;
  currentLiveStartedAt: number | null;
};

export type RoomStatus = {
  broadcastHost: string | null;
  broadcastKey: string | null;
  broadcastPort: number | null;
  isLive: boolean;
  liveStatus: number | null;
  roomId: number | null;
  roomUrlKey: string;
};

export type EventAndSupportSummary = {
  event: {
    id: number;
    name: string;
    imageUrl: string;
    startAt: number;
    endAt: number;
    eventUrl: string;
  } | null;
  support: {
    id: number;
    name: string;
  } | null;
  ranking: {
    rank: number;
    beforeRank: number;
    point: string;
    gap: string;
  } | null;
};

export type ActiveFanSummary = {
  fanName: string;
  totalUserCount: string;
};

export async function getRoomProfile(
  roomId: number | string
): Promise<RoomProfile> {
  const url = new URL(SHOWROOM_API_URL.roomProfile);
  url.searchParams.set("room_id", String(roomId));

  const rawData =
    await fetchShowroomJson<ShowroomRoomProfileResponse>(url);

  return {
    roomId: rawData.room_id,
    roomUrlKey: rawData.room_url_key,
    roomName: rawData.room_name,
    roomImageUrl: toLargeImageUrl(rawData.image),
    isOnlive: rawData.is_onlive,
    premiumRoomType: rawData.premium_room_type,
    followerNum: rawData.follower_num.toLocaleString(),
    viewNum: toFiniteNumber(rawData.view_num),
    genreName: rawData.genre_name,
    isOfficial: rawData.is_official,
    roomLevel: rawData.room_level.toLocaleString(),
    leagueLabel: rawData.league_label,
    showRankSubdivided: rawData.show_rank_subdivided,
    showRankTimeCharge: getTimeChargeByRank(rawData.show_rank_subdivided),
    nextShowRankSubdivided: rawData.next_show_rank_subdivided,
    currentLiveStartedAt: rawData.current_live_started_at,
  };
}

export async function getRoomStatus(roomUrlKey: string): Promise<RoomStatus> {
  const normalizedRoomUrlKey = roomUrlKey.trim();

  if (!normalizedRoomUrlKey) {
    throw new Error("room_url_key is required");
  }

  const url = new URL(SHOWROOM_API_URL.roomStatus);
  url.searchParams.set("room_url_key", normalizedRoomUrlKey);

  const rawData = await fetchShowroomJson<ShowroomRoomStatusResponse>(url);

  return {
    broadcastHost: rawData.broadcast_host?.trim() || null,
    broadcastKey: rawData.broadcast_key?.trim() || null,
    broadcastPort: toFiniteNumber(rawData.broadcast_port),
    isLive: rawData.is_live === true,
    liveStatus: toFiniteNumber(rawData.live_status),
    roomId: toFiniteNumber(rawData.room_id),
    roomUrlKey: rawData.room_url_key?.trim() || normalizedRoomUrlKey,
  };
}

export async function getRoomEventAndSupport(
  roomId: number | string
): Promise<EventAndSupportSummary> {
  const url = new URL(SHOWROOM_API_URL.eventAndSupport);
  url.searchParams.set("room_id", String(roomId));

  const rawData =
    await fetchShowroomJson<ShowroomEventAndSupportResponse>(url);

  return {
    event: rawData.event
      ? {
        id: rawData.event.event_id,
        name: rawData.event.event_name,
        imageUrl: toLargeImageUrl(rawData.event.image),
        startAt: rawData.event.started_at,
        endAt: rawData.event.ended_at,
        eventUrl: rawData.event.event_url,
      }
      : null,
    support: rawData.support
      ? {
        id: rawData.support.support_id,
        name: rawData.support.name,
      }
      : null,
    ranking: rawData.event?.ranking
      ? {
        rank: rawData.event.ranking.rank,
        beforeRank: rawData.event.ranking.before_rank,
        point: rawData.event.ranking.point.toLocaleString(),
        gap: rawData.event.ranking.gap.toLocaleString(),
      }
      : null,
  };
}

export async function getRoomActiveFan(
  roomId: number | string,
  now = new Date()
): Promise<ActiveFanSummary> {
  const url = new URL(SHOWROOM_API_URL.activeFan);
  url.searchParams.set("room_id", String(roomId));

  const jstNow = toJstWallTimeDate(now);
  const year = jstNow.getUTCFullYear();
  const month = String(jstNow.getUTCMonth() + 1).padStart(2, "0");
  url.searchParams.set("ym", `${year}${month}`);

  const rawData = await fetchShowroomJson<ShowroomActiveFanResponse>(url);

  return {
    fanName: rawData.fan_name,
    totalUserCount: rawData.total_user_count.toLocaleString(),
  };
}
