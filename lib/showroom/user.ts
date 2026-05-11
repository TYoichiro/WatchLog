import {
  SHOWROOM_API_URL,
  fetchShowroomJson,
  toFiniteNumber,
  toUnixSeconds,
} from "./core";

type ShowroomUserProfileSnsItem = {
  icon?: string | null;
  url?: string | null;
  name?: string | null;
};

type ShowroomUserRoomProfileBannerItem = {
  image?: string | null;
  url?: string | null;
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
  avatar?: string | { description?: string | null; list?: string[] | null } | null;
  view_num?: number | string | null;
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
    avatarUrl: typeof rawData.avatar === "string" ? rawData.avatar.trim() || null : null,
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
