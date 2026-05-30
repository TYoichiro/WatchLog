import {
  SHOWROOM_API_URL,
  SHOWROOM_HEADERS,
  fetchShowroomJson,
  toFiniteNumber,
  toUnixSeconds,
} from "./core";

const PREMIUM_LIVE_FALLBACK_ROOM_ID = 317313;

async function fetchGiftGroupsJson(roomId: number | string): Promise<ShowroomGiftGroupsResponse> {
  const url = new URL(SHOWROOM_API_URL.giftGroups);
  url.searchParams.set("room_id", String(roomId));

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: SHOWROOM_HEADERS,
  });

  const data = await response.json() as Record<string, unknown>;

  const isPremiumLiveError =
    !response.ok ||
    (Array.isArray(data.errors) &&
      (data.errors as Array<{ code?: number }>).some((e) => e.code === 1002));

  if (isPremiumLiveError) {
    const fallbackUrl = new URL(SHOWROOM_API_URL.giftGroups);
    fallbackUrl.searchParams.set("room_id", String(PREMIUM_LIVE_FALLBACK_ROOM_ID));
    return fetchShowroomJson<ShowroomGiftGroupsResponse>(fallbackUrl);
  }

  return data as ShowroomGiftGroupsResponse;
}

type ShowroomGiftLogItem = {
  avatar_id?: number | null;
  avatar_url?: string | null;
  created_at?: number | string | null;
  gift_id?: number | null;
  image?: string | null;
  image2?: string | null;
  name?: string | null;
  num?: number | null;
  ua?: number | string | null;
  user_id?: number | string | null;
};

type ShowroomGiftLogResponse = {
  gift_log: ShowroomGiftLogItem[];
};

type ShowroomGiftDefinition = {
  free?: boolean | null;
  gift_id: number;
  gift_name?: string | null;
  image?: string | null;
  point?: number | null;
};

type ShowroomGiftGroup = {
  gift_list?: ShowroomGiftDefinition[] | null;
};

type ShowroomGiftGroupsResponse = {
  enquete?: ShowroomGiftDefinition[] | null;
  gift_groups?: ShowroomGiftGroup[] | null;
};

const FREE_GIFT_DEFINITIONS = [
  { giftId: 10001, giftName: "1" },
  { giftId: 10002, giftName: "2" },
  { giftId: 10003, giftName: "3" },
  { giftId: 10004, giftName: "4" },
  { giftId: 10005, giftName: "5" },
  { giftId: 10006, giftName: "6" },
  { giftId: 10007, giftName: "7" },
  { giftId: 10008, giftName: "8" },
  { giftId: 10009, giftName: "9" },
  { giftId: 10010, giftName: "10" },
  { giftId: 10011, giftName: "11" },
  { giftId: 10012, giftName: "12" },
  { giftId: 10013, giftName: "13" },
  { giftId: 10014, giftName: "14" },
  { giftId: 10015, giftName: "15" },
  { giftId: 10016, giftName: "16" },
  { giftId: 10017, giftName: "17" },
  { giftId: 10018, giftName: "18" },
  { giftId: 10019, giftName: "19" },
  { giftId: 10020, giftName: "20" },
  { giftId: 10021, giftName: "21" },
  { giftId: 10022, giftName: "22" },
  { giftId: 10023, giftName: "23" },
  { giftId: 10024, giftName: "24" },
  { giftId: 10025, giftName: "25" },
  { giftId: 3001139, giftName: "イベントがんばれミニタワー(アニメ)(無料)" },
  { giftId: 3001140, giftName: "イベントおつかれミニタワー(アニメ)(無料)" },
  { giftId: 3000286, giftName: "ゴールデンハート(アニメ)(無料)" },
  { giftId: 3001008, giftName: "優勝(アニメ)(無料)" },
  { giftId: 3000421, giftName: "キラキラ星" },
  { giftId: 3000669, giftName: "星（オレンジ）" },
  { giftId: 3000670, giftName: "星（水色）" },
  { giftId: 3000671, giftName: "星（赤）" },
  { giftId: 3000672, giftName: "星（紫）" },
  { giftId: 3000673, giftName: "星（黄緑）" },
  { giftId: 3000841, giftName: "種(黄)" },
  { giftId: 3000842, giftName: "種(赤)" },
  { giftId: 3000843, giftName: "種(紫)" },
  { giftId: 3000844, giftName: "種(緑)" },
  { giftId: 3000845, giftName: "種(青)" },
] as const;

const FREE_GIFT_NAME_BY_ID = new Map<number, string>(
  FREE_GIFT_DEFINITIONS.map((item) => [item.giftId, item.giftName])
);
const FREE_GIFT_ID_SET = new Set<number>(
  FREE_GIFT_DEFINITIONS.map((item) => item.giftId)
);

const GIFT_LOG_MERGE_WINDOW_SECONDS = 30;

function getGiftDefinitionsFromGroups(
  rawData: ShowroomGiftGroupsResponse
): ShowroomGiftDefinition[] {
  const enquete = Array.isArray(rawData.enquete) ? rawData.enquete : [];
  const grouped = Array.isArray(rawData.gift_groups)
    ? rawData.gift_groups.flatMap((group) =>
      Array.isArray(group.gift_list) ? group.gift_list : []
    )
    : [];

  return [...enquete, ...grouped];
}

function isAllowlistedFreeGift(giftId: number | null): boolean {
  return giftId !== null && FREE_GIFT_ID_SET.has(giftId);
}

function normalizeGiftDefinition(
  item: ShowroomGiftDefinition
): RoomGiftDefinition {
  const rawPoint =
    typeof item.point === "number" && Number.isFinite(item.point)
      ? item.point
      : null;
  const isFree = isAllowlistedFreeGift(item.gift_id);
  const point = isFree ? rawPoint ?? 0 : rawPoint === 0 ? null : rawPoint;

  return {
    giftId: item.gift_id,
    giftImageUrl: item.image ?? null,
    giftName:
      FREE_GIFT_NAME_BY_ID.get(item.gift_id) ||
      item.gift_name?.trim() ||
      `Gift #${item.gift_id}`,
    isFree,
    point,
  };
}

function calculateGiftTotalPoint(
  point: number | null,
  count: number
): number | null {
  if (point === null) {
    return null;
  }

  return (point === 0 ? 1 : point) * count;
}

function aggregateRoomGiftLogs(items: RoomGiftLog[]): RoomGiftLog[] {
  const aggregated: RoomGiftLog[] = [];
  const lastGiftByUserAndGift = new Map<
    string,
    { boundaryCreatedAt: number; index: number }
  >();

  for (const item of items) {
    if (
      item.userId === null ||
      item.giftId === null ||
      item.createdAt === null
    ) {
      aggregated.push(item);
      continue;
    }

    const mergeKey = `${item.userId}:${item.giftId}`;
    const previous = lastGiftByUserAndGift.get(mergeKey);

    if (
      previous &&
      Math.abs(previous.boundaryCreatedAt - item.createdAt) <=
      GIFT_LOG_MERGE_WINDOW_SECONDS
    ) {
      const mergedItem = aggregated[previous.index];
      const count = mergedItem.count + item.count;

      aggregated[previous.index] = {
        ...mergedItem,
        count,
        totalPoint: calculateGiftTotalPoint(mergedItem.point, count),
      };
      lastGiftByUserAndGift.set(mergeKey, {
        boundaryCreatedAt: item.createdAt,
        index: previous.index,
      });
      continue;
    }

    aggregated.push(item);
    lastGiftByUserAndGift.set(mergeKey, {
      boundaryCreatedAt: item.createdAt,
      index: aggregated.length - 1,
    });
  }

  return aggregated;
}

export type RoomGiftLog = {
  id: string;
  avatarId: number | null;
  avatarUrl: string | null;
  count: number;
  createdAt: number | null;
  giftId: number | null;
  giftImageUrl: string | null;
  giftName: string;
  isFree: boolean | null;
  point: number | null;
  totalPoint: number | null;
  userId: string | null;
  userImageUrl: string | null;
  userName: string;
  userVisitStatus: number | null;
};

export type RoomGiftDefinition = {
  giftId: number;
  giftImageUrl: string | null;
  giftName: string;
  isFree: boolean;
  point: number | null;
};

export async function getRoomGiftDefinitions(
  roomId: number | string
): Promise<RoomGiftDefinition[]> {
  const rawData = await fetchGiftGroupsJson(roomId);
  const giftDefinitions = new Map<number, RoomGiftDefinition>();

  FREE_GIFT_DEFINITIONS.forEach((item) => {
    giftDefinitions.set(item.giftId, {
      giftId: item.giftId,
      giftImageUrl: null,
      giftName: item.giftName,
      isFree: true,
      point: 0,
    });
  });

  getGiftDefinitionsFromGroups(rawData).forEach((item) => {
    giftDefinitions.set(item.gift_id, normalizeGiftDefinition(item));
  });

  return [...giftDefinitions.values()];
}

export async function getRoomGiftLog(
  roomId: number | string
): Promise<RoomGiftLog[]> {
  const giftLogUrl = new URL(SHOWROOM_API_URL.giftLog);
  giftLogUrl.searchParams.set("room_id", String(roomId));

  const [giftLogData, giftGroupsData] = await Promise.all([
    fetchShowroomJson<ShowroomGiftLogResponse>(giftLogUrl),
    fetchGiftGroupsJson(roomId),
  ]);

  const giftMap = new Map<number, RoomGiftDefinition>();

  getGiftDefinitionsFromGroups(giftGroupsData).forEach((item) => {
    giftMap.set(item.gift_id, normalizeGiftDefinition(item));
  });

  const normalizedGiftLogs = giftLogData.gift_log.map((item, index) => {
    const giftId = typeof item.gift_id === "number" ? item.gift_id : null;
    const giftMeta = giftId === null ? undefined : giftMap.get(giftId);
    const count =
      typeof item.num === "number" && Number.isFinite(item.num) ? item.num : 0;
    const isFree = isAllowlistedFreeGift(giftId);
    const point = isFree ? giftMeta?.point ?? 0 : giftMeta?.point ?? null;
    const isPaid = !isFree && typeof point === "number" && point > 0;

    return {
      id: `${item.user_id ?? "guest"}-${giftId ?? "unknown"}-${item.created_at ?? index}`,
      avatarId:
        typeof item.avatar_id === "number" ? item.avatar_id : null,
      avatarUrl: item.avatar_url ?? null,
      count,
      createdAt: toUnixSeconds(item.created_at),
      giftId,
      giftImageUrl: giftMeta?.giftImageUrl ?? item.image2 ?? null,
      giftName:
        giftMeta?.giftName ||
        (giftId === null ? "Unknown gift" : `Gift #${giftId}`),
      isFree: isFree ? true : isPaid ? false : null,
      point,
      totalPoint: calculateGiftTotalPoint(point, count),
      userId:
        item.user_id === null || item.user_id === undefined
          ? null
          : String(item.user_id),
      userImageUrl: item.image ?? null,
      userName: item.name?.trim() || "Unknown",
      userVisitStatus: toFiniteNumber(item.ua),
    };
  });

  return aggregateRoomGiftLogs(normalizedGiftLogs);
}

export async function getRoomPaidGiftLog(
  roomId: number | string
): Promise<RoomGiftLog[]> {
  const giftLogs = await getRoomGiftLog(roomId);

  return giftLogs.filter(
    (item) => item.isFree === false
  );
}
