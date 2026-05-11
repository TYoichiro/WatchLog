import {
  SHOWROOM_API_URL,
  fetchShowroomJson,
  toFiniteNumber,
} from "./core";

type ShowroomStageUser = {
  avatar_id?: number | null;
  avatar_url?: string | null;
  badge?: number | null;
  badge_type?: number | null;
  image?: string | null;
  name?: string | null;
  ua?: number | string | null;
  user_id?: number | string | null;
};

type ShowroomStageUserListItem = {
  order_no?: number | null;
  rank?: number | null;
  user?: ShowroomStageUser | null;
};

type ShowroomStageUserListResponse = {
  stage_user_list?: ShowroomStageUserListItem[] | null;
};

type ShowroomSummaryRankingItem = {
  avatar_id?: number | null;
  avatar_url?: string | null;
  name?: string | null;
  order?: number | null;
  point?: number | null;
  rank?: number | null;
  ua?: number | string | null;
  user_id?: number | string | null;
  visit_count?: number | null;
};

type ShowroomSummaryRankingResponse = {
  ranking?: ShowroomSummaryRankingItem[] | null;
};

export type RoomLiveRankingUser = {
  id: string;
  avatarId: number | null;
  avatarUrl: string | null;
  badge: number | null;
  badgeType: number | null;
  orderNo: number | null;
  rank: number;
  userId: string | null;
  userImageUrl: string | null;
  userName: string;
  userVisitStatus: number | null;
};

export type RoomTotalRankingUser = {
  id: string;
  avatarId: number | null;
  avatarUrl: string | null;
  order: number | null;
  point: number;
  rank: number;
  userId: string | null;
  userName: string;
  userVisitStatus: number | null;
  visitCount: number | null;
};

export async function getRoomLiveRanking(
  roomId: number | string
): Promise<RoomLiveRankingUser[]> {
  const url = new URL(SHOWROOM_API_URL.stageUserList);
  url.searchParams.set("room_id", String(roomId));

  const rawData =
    await fetchShowroomJson<ShowroomStageUserListResponse>(url);
  const items = Array.isArray(rawData.stage_user_list)
    ? rawData.stage_user_list
    : [];

  return items.map((item, index) => {
    const rank =
      typeof item.rank === "number" && Number.isFinite(item.rank)
        ? item.rank
        : typeof item.order_no === "number" && Number.isFinite(item.order_no)
          ? item.order_no
          : index + 1;

    return {
      id: `${item.user?.user_id ?? "guest"}-${rank}-${item.order_no ?? index}`,
      avatarId:
        typeof item.user?.avatar_id === "number" ? item.user.avatar_id : null,
      avatarUrl: item.user?.avatar_url ?? null,
      badge:
        typeof item.user?.badge === "number" && Number.isFinite(item.user.badge)
          ? item.user.badge
          : null,
      badgeType:
        typeof item.user?.badge_type === "number" &&
          Number.isFinite(item.user.badge_type)
          ? item.user.badge_type
          : null,
      orderNo:
        typeof item.order_no === "number" && Number.isFinite(item.order_no)
          ? item.order_no
          : null,
      rank,
      userId:
        item.user?.user_id === null || item.user?.user_id === undefined
          ? null
          : String(item.user.user_id),
      userImageUrl: item.user?.image ?? null,
      userName: item.user?.name?.trim() || "Unknown",
      userVisitStatus: toFiniteNumber(item.user?.ua),
    };
  });
}

export async function getRoomTotalRanking(
  roomId: number | string
): Promise<RoomTotalRankingUser[]> {
  const url = new URL(SHOWROOM_API_URL.summaryRanking);
  url.searchParams.set("room_id", String(roomId));

  const rawData =
    await fetchShowroomJson<ShowroomSummaryRankingResponse>(url);
  const items = Array.isArray(rawData.ranking) ? rawData.ranking : [];

  return items.map((item, index) => {
    const rank =
      typeof item.rank === "number" && Number.isFinite(item.rank)
        ? item.rank
        : typeof item.order === "number" && Number.isFinite(item.order)
          ? item.order
          : index + 1;

    return {
      id: `${item.user_id ?? "guest"}-${rank}-${item.order ?? index}`,
      avatarId:
        typeof item.avatar_id === "number" ? item.avatar_id : null,
      avatarUrl: item.avatar_url ?? null,
      order:
        typeof item.order === "number" && Number.isFinite(item.order)
          ? item.order
          : null,
      point:
        typeof item.point === "number" && Number.isFinite(item.point)
          ? item.point
          : 0,
      rank,
      userId:
        item.user_id === null || item.user_id === undefined
          ? null
          : String(item.user_id),
      userName: item.name?.trim() || "Unknown",
      userVisitStatus: toFiniteNumber(item.ua),
      visitCount:
        typeof item.visit_count === "number" && Number.isFinite(item.visit_count)
          ? item.visit_count
          : null,
    };
  });
}
