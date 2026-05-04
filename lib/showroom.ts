const SHOWROOM_HEADERS = {
  "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
} as const;

const SHOWROOM_HTML_HEADERS = {
  ...SHOWROOM_HEADERS,
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
} as const;

const SHOWROOM_API_URL = {
  activeFan: "https://www.showroom-live.com/api/active_fan/room",
  commentLog: "https://www.showroom-live.com/api/live/comment_log",
  giftGroups: "https://www.showroom-live.com/api/live/gift_groups",
  giftLog: "https://www.showroom-live.com/api/live/gift_log",
  liveInfo: "https://www.showroom-live.com/api/live/live_info",
  telop: "https://www.showroom-live.com/api/live/telop",
  stageUserList: "https://www.showroom-live.com/api/live/stage_user_list",
  summaryRanking: "https://www.showroom-live.com/api/live/summary_ranking",
  eventAndSupport: "https://www.showroom-live.com/api/room/event_and_support",
  roomProfile: "https://www.showroom-live.com/api/room/profile",
  roomStatus: "https://www.showroom-live.com/api/room/status",
  userProfile: "https://www.showroom-live.com/api/user/profile",
} as const;

const SHOWROOM_WEB_URL = {
  roomSearch: "https://www.showroom-live.com/room/search",
} as const;

const SHOWROOM_ORIGIN = "https://www.showroom-live.com";

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

type ShowroomCommentLogResponse = {
  comment_log: ShowroomCommentLogItem[];
};

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

type ShowroomTelopResponse = {
  telop?: string | null;
};

type ShowroomGiftLogResponse = {
  gift_log: ShowroomGiftLogItem[];
};

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

type ShowroomGiftGroupsResponse = {
  enquete?: ShowroomGiftDefinition[] | null;
  gift_groups?: ShowroomGiftGroup[] | null;
};

type ShowroomLiveInfoResponse = {
  bcsvr_key?: string | null;
  live_id?: number | string | null;
  live_status?: number | string | null;
};

type ShowroomStageUserListResponse = {
  stage_user_list?: ShowroomStageUserListItem[] | null;
};

type ShowroomStageUserListItem = {
  order_no?: number | null;
  rank?: number | null;
  user?: ShowroomStageUser | null;
};

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

type ShowroomSummaryRankingResponse = {
  ranking?: ShowroomSummaryRankingItem[] | null;
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

type ShowroomUserProfileResponse = {
  sns_list?: ShowroomUserProfileSnsItem[] | null;
  avatar_id?: number | string | null;
  class_level?: number | string | null;
  fan_level?: number | string | null;
  active_fan_level?: number | string | null;
  name?: string | null;
  avatar_url?: string | null;
  description?: string | null;
  image?: string | null;
  is_sms_authenticated?: boolean | null;
  room_profile?: ShowroomUserRoomProfileResponse | null;
};

type ShowroomUserProfileSnsItem = {
  icon?: string | null;
  url?: string | null;
  name?: string | null;
};

type ShowroomUserRoomProfileResponse = {
  banner_list?: ShowroomUserRoomProfileBannerItem[] | null;
  current_live_started_at?: number | string | null;
  description?: string | null;
  follower_num?: number | string | null;
  genre_name?: string | null;
  image?: string | null;
  image_square?: string | null;
  is_official?: boolean | null;
  is_onlive?: boolean | null;
  league_label?: string | null;
  main_name?: string | null;
  room_id?: number | string | null;
  room_level?: number | string | null;
  room_name?: string | null;
  room_url_key?: string | null;
  share_text_live?: string | null;
  share_url?: string | null;
  share_url_live?: string | null;
  sns_list?: ShowroomUserProfileSnsItem[] | null;
  avatar?: string | null;
  view_num?: number | string | null;
};

type ShowroomUserRoomProfileBannerItem = {
  image?: string | null;
  url?: string | null;
};

type ShowroomGiftGroup = {
  gift_list?: ShowroomGiftDefinition[] | null;
};

type ShowroomGiftDefinition = {
  free?: boolean | null;
  gift_id: number;
  gift_name?: string | null;
  image?: string | null;
  point?: number | null;
};

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

export type RoomLiveInfo = {
  bcsvrKey: string | null;
  liveId: string | null;
  liveStatus: number | null;
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

export type RoomUserProfile = {
  activeFanLevel: number | null;
  avatarId: number | null;
  avatarUrl: string | null;
  classLevel: number | null;
  description: string;
  fanLevel: number | null;
  imageUrl: string | null;
  isSmsAuthenticated: boolean;
  name: string;
  snsList: {
    icon: string;
    url: string;
    name: string | null;
  }[];
  roomProfile: RoomUserRoomProfile | null;
};

export type RoomUserRoomProfile = {
  avatarUrl: string | null;
  banners: {
    imageUrl: string;
    url: string | null;
  }[];
  currentLiveStartedAt: number | null;
  description: string;
  followerNum: number | null;
  genreName: string;
  imageSquareUrl: string | null;
  imageUrl: string | null;
  isOfficial: boolean;
  isOnlive: boolean;
  leagueLabel: string;
  mainName: string;
  roomId: number | null;
  roomLevel: number | null;
  roomName: string;
  roomUrlKey: string;
  shareTextLive: string;
  shareUrl: string | null;
  shareUrlLive: string | null;
  snsList: {
    icon: string;
    url: string;
    name: string | null;
  }[];
  viewNum: number | null;
};

export type RoomSearchResult = {
  imageUrl: string;
  roomId: string;
  roomName: string;
  roomUrl: string;
};

const GIFT_LOG_MERGE_WINDOW_SECONDS = 30;

function toLargeImageUrl(imageUrl: string): string {
  return imageUrl.replace("_s.", "_l.").replace("_m.", "_l.");
}

function getTimeChargeByRank(rank: string): string | null {
  return RANK_TIME_CHARGE_MAP[rank] ?? null;
}

async function fetchShowroomJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: SHOWROOM_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Showroom API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchShowroomHtml(url: URL): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: SHOWROOM_HTML_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Showroom HTML request failed: ${response.status}`);
  }

  return response.text();
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      const normalizedCode = code.toLowerCase();

      if (normalizedCode.startsWith("#x")) {
        const parsed = Number.parseInt(normalizedCode.slice(2), 16);
        return Number.isFinite(parsed) && parsed <= 0x10ffff
          ? String.fromCodePoint(parsed)
          : entity;
      }

      if (normalizedCode.startsWith("#")) {
        const parsed = Number.parseInt(normalizedCode.slice(1), 10);
        return Number.isFinite(parsed) && parsed <= 0x10ffff
          ? String.fromCodePoint(parsed)
          : entity;
      }

      return namedEntities[normalizedCode] ?? entity;
    }
  );
}

function getHtmlAttribute(tag: string, attributeName: string): string | null {
  const pattern = new RegExp(
    `\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  );
  const match = tag.match(pattern);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];

  return value ? decodeHtmlEntities(value).trim() : null;
}

function hasHtmlClass(tag: string, className: string): boolean {
  const classes = getHtmlAttribute(tag, "class");

  return classes?.split(/\s+/).includes(className) ?? false;
}

function normalizeHtmlText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function getRoomNameFromSearchResult(html: string, startIndex: number): string {
  const nearbyHtml = html.slice(startIndex, startIndex + 6000);
  const titleMatch = nearbyHtml.match(
    /<h4\b[^>]*\blistcardinfo-main-text\b[^>]*>([\s\S]*?)<\/h4>/i
  );

  return titleMatch ? normalizeHtmlText(titleMatch[1]) : "";
}

function normalizeRoomUrlKey(href: string): string {
  try {
    const url = new URL(href, SHOWROOM_ORIGIN);
    return url.pathname.replace(/^\/r\//, "").replace(/^\/+/, "");
  } catch {
    return href
      .split(/[?#]/, 1)[0]
      .replace(/^\/r\//, "")
      .replace(/^r\//, "")
      .replace(/^\/+/, "");
  }
}

function parseRoomSearchResults(html: string): RoomSearchResult[] {
  const results: RoomSearchResult[] = [];
  const seenRooms = new Set<string>();
  const anchorPattern = /<a\b[^>]*>[\s\S]*?<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const anchorHtml = match[0];
    const anchorTag = anchorHtml.match(/^<a\b[^>]*>/i)?.[0];
    const imageTag = anchorHtml.match(/<img\b[^>]*>/i)?.[0];

    if (!anchorTag || !imageTag || !hasHtmlClass(anchorTag, "room-url")) {
      continue;
    }

    const roomId = getHtmlAttribute(anchorTag, "data-room-id");
    const href = getHtmlAttribute(anchorTag, "href");
    const imageUrl =
      getHtmlAttribute(imageTag, "data-src") ?? getHtmlAttribute(imageTag, "src");

    if (!roomId || !href || !imageUrl) {
      continue;
    }

    const roomUrl = normalizeRoomUrlKey(href);

    if (!roomUrl) {
      continue;
    }

    const dedupeKey = `${roomId}:${roomUrl}`;

    if (seenRooms.has(dedupeKey)) {
      continue;
    }

    seenRooms.add(dedupeKey);
    results.push({
      imageUrl,
      roomId,
      roomName: getRoomNameFromSearchResult(html, match.index ?? 0),
      roomUrl,
    });
  }

  return results;
}

function toCommentCreatedAt(
  value: ShowroomCommentLogItem["create_at"]
): number | null {
  return toFiniteNumber(value);
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toUnixSeconds(value: number | string | null | undefined): number | null {
  return toFiniteNumber(value);
}

function normalizeSnsList(
  items: ShowroomUserProfileSnsItem[] | null | undefined
): {
  icon: string;
  url: string;
  name: string | null;
}[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    const icon = item.icon?.trim();
    const linkUrl = item.url?.trim();

    if (!icon || !linkUrl) {
      return [];
    }

    return [{
      icon,
      url: linkUrl,
      name: item.name?.trim() || null,
    }];
  });
}

function normalizeUserRoomProfile(
  rawData: ShowroomUserRoomProfileResponse | null | undefined
): RoomUserRoomProfile | null {
  if (!rawData) {
    return null;
  }

  const banners = Array.isArray(rawData.banner_list)
    ? rawData.banner_list.flatMap((item) => {
      const imageUrl = item.image?.trim();

      if (!imageUrl) {
        return [];
      }

      return [{
        imageUrl,
        url: item.url?.trim() || null,
      }];
    })
    : [];

  return {
    avatarUrl: rawData.avatar?.trim() || null,
    banners,
    currentLiveStartedAt: toUnixSeconds(rawData.current_live_started_at),
    description: rawData.description?.trim() || "",
    followerNum: toFiniteNumber(rawData.follower_num),
    genreName: rawData.genre_name?.trim() || "",
    imageSquareUrl: rawData.image_square?.trim() || null,
    imageUrl: rawData.image?.trim() || null,
    isOfficial: rawData.is_official === true,
    isOnlive: rawData.is_onlive === true,
    leagueLabel: rawData.league_label?.trim() || "",
    mainName: rawData.main_name?.trim() || "",
    roomId: toFiniteNumber(rawData.room_id),
    roomLevel: toFiniteNumber(rawData.room_level),
    roomName: rawData.room_name?.trim() || "",
    roomUrlKey: rawData.room_url_key?.trim() || "",
    shareTextLive: rawData.share_text_live?.trim() || "",
    shareUrl: rawData.share_url?.trim() || null,
    shareUrlLive: rawData.share_url_live?.trim() || null,
    snsList: normalizeSnsList(rawData.sns_list),
    viewNum: toFiniteNumber(rawData.view_num),
  };
}

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

export async function searchShowroomRooms(
  keyword: string
): Promise<RoomSearchResult[]> {
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return [];
  }

  const url = new URL(SHOWROOM_WEB_URL.roomSearch);
  url.searchParams.set("genre_id", "0");
  url.searchParams.set("keyword", normalizedKeyword);

  return parseRoomSearchResults(await fetchShowroomHtml(url));
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

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  url.searchParams.set("ym", `${year}${month}`);

  const rawData = await fetchShowroomJson<ShowroomActiveFanResponse>(url);

  return {
    fanName: rawData.fan_name,
    totalUserCount: rawData.total_user_count.toLocaleString(),
  };
}

export async function getRoomUserProfile(
  roomId: number | string,
  userId: number | string
): Promise<RoomUserProfile> {
  const url = new URL(SHOWROOM_API_URL.userProfile);
  url.searchParams.set("room_id", String(roomId));
  url.searchParams.set("user_id", String(userId));

  const rawData = await fetchShowroomJson<ShowroomUserProfileResponse>(url);

  return {
    activeFanLevel: toFiniteNumber(rawData.active_fan_level),
    avatarId: toFiniteNumber(rawData.avatar_id),
    avatarUrl: rawData.avatar_url?.trim() || null,
    classLevel: toFiniteNumber(rawData.class_level),
    description: rawData.description?.trim() || "",
    fanLevel: toFiniteNumber(rawData.fan_level),
    imageUrl: rawData.image?.trim() || null,
    isSmsAuthenticated: rawData.is_sms_authenticated === true,
    name: rawData.name?.trim() || "Unknown",
    snsList: normalizeSnsList(rawData.sns_list),
    roomProfile: normalizeUserRoomProfile(rawData.room_profile),
  };
}

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
    classLevel: toUnixSeconds(item.class_level),
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

export async function getRoomGiftDefinitions(
  roomId: number | string
): Promise<RoomGiftDefinition[]> {
  const url = new URL(SHOWROOM_API_URL.giftGroups);
  url.searchParams.set("room_id", String(roomId));

  const rawData = await fetchShowroomJson<ShowroomGiftGroupsResponse>(url);
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

  const giftGroupsUrl = new URL(SHOWROOM_API_URL.giftGroups);
  giftGroupsUrl.searchParams.set("room_id", String(roomId));

  const [giftLogData, giftGroupsData] = await Promise.all([
    fetchShowroomJson<ShowroomGiftLogResponse>(giftLogUrl),
    fetchShowroomJson<ShowroomGiftGroupsResponse>(giftGroupsUrl),
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

export async function getRoomPaidGiftLog(
  roomId: number | string
): Promise<RoomGiftLog[]> {
  const giftLogs = await getRoomGiftLog(roomId);

  return giftLogs.filter(
    (item) => item.isFree === false
  );
}
