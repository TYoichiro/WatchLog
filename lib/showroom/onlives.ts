import { SHOWROOM_API_URL, fetchShowroomJson } from "./core";

type ShowroomOnliveBadgeRaw = {
  image_url: string;
  type: string;
  id: number;
};

type ShowroomStreamingUrlRaw = {
  is_default: boolean;
  url: string;
  label: string;
  type: string;
  id: number;
  quality: number;
};

type ShowroomOnliveItemRaw = {
  room_id: number;
  room_url_key: string;
  main_name: string;
  image: string;
  image_square?: string;
  view_num: number;
  follower_num: number;
  started_at: number;
  live_id: number;
  genre_id: number;
  genre_name: string;
  badge_list: ShowroomOnliveBadgeRaw[];
  streaming_url_list: ShowroomStreamingUrlRaw[];
  bcsvr_key: string;
  telop?: string;
  liver_theme_title: string;
  everyday_live_label?: string;
  genre_ranking_rank: number;
  is_karaoke?: boolean;
  premium_room_type: number;
  frame_image_url?: string;
};

type ShowroomOnliveGenreRaw = {
  genre_id: number;
  genre_name: string;
  has_upcoming: boolean;
  lives: ShowroomOnliveItemRaw[];
};

type ShowroomOnlivesRawResponse = {
  onlives: ShowroomOnliveGenreRaw[];
};

export type OnliveBadge = {
  imageUrl: string;
  type: string;
  id: number;
};

export type OnliveStreamingUrl = {
  isDefault: boolean;
  url: string;
  label: string;
  id: number;
  quality: number;
};

export type OnliveItem = {
  roomId: number;
  roomUrlKey: string;
  mainName: string;
  image: string;
  imageSquare: string | null;
  viewNum: number;
  followerNum: number;
  startedAt: number;
  liveId: number;
  genreId: number;
  genreName: string;
  badgeList: OnliveBadge[];
  streamingUrlList: OnliveStreamingUrl[];
  telop: string | null;
  liverThemeTitle: string;
  everydayLiveLabel: string | null;
  genreRankingRank: number;
  isKaraoke: boolean;
  premiumRoomType: number;
  frameImageUrl: string | null;
};

export type OnliveGenre = {
  genreId: number;
  genreName: string;
  hasUpcoming: boolean;
  lives: OnliveItem[];
};

export type OnlivesResult = {
  onlives: OnliveGenre[];
};

function mapOnliveItem(raw: ShowroomOnliveItemRaw): OnliveItem {
  return {
    roomId: raw.room_id,
    roomUrlKey: raw.room_url_key,
    mainName: raw.main_name,
    image: raw.image,
    imageSquare: raw.image_square ?? null,
    viewNum: raw.view_num,
    followerNum: raw.follower_num,
    startedAt: raw.started_at,
    liveId: raw.live_id,
    genreId: raw.genre_id,
    genreName: raw.genre_name,
    badgeList: raw.badge_list.map((b) => ({
      imageUrl: b.image_url,
      type: b.type,
      id: b.id,
    })),
    streamingUrlList: raw.streaming_url_list.map((s) => ({
      isDefault: s.is_default,
      url: s.url,
      label: s.label,
      id: s.id,
      quality: s.quality,
    })),
    telop: raw.telop ?? null,
    liverThemeTitle: raw.liver_theme_title,
    everydayLiveLabel: raw.everyday_live_label ?? null,
    genreRankingRank: raw.genre_ranking_rank,
    isKaraoke: raw.is_karaoke ?? false,
    premiumRoomType: raw.premium_room_type,
    frameImageUrl: raw.frame_image_url ?? null,
  };
}

export async function getOnlives(): Promise<OnlivesResult> {
  const raw = await fetchShowroomJson<ShowroomOnlivesRawResponse>(
    new URL(SHOWROOM_API_URL.onlives),
  );

  return {
    onlives: raw.onlives.map((genre) => ({
      genreId: genre.genre_id,
      genreName: genre.genre_name,
      hasUpcoming: genre.has_upcoming,
      lives: genre.lives.map(mapOnliveItem),
    })),
  };
}
