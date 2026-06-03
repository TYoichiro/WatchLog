export const SHOWROOM_HEADERS = {
  "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
} as const;

export const SHOWROOM_HTML_HEADERS = {
  ...SHOWROOM_HEADERS,
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
} as const;

export const SHOWROOM_API_URL = {
  activeFan: "https://www.showroom-live.com/api/active_fan/room",
  commentLog: "https://www.showroom-live.com/api/live/comment_log",
  giftGroups: "https://www.showroom-live.com/api/live/gift_groups",
  giftLog: "https://www.showroom-live.com/api/live/gift_log",
  liveInfo: "https://www.showroom-live.com/api/live/live_info",
  onlives: "https://www.showroom-live.com/api/live/onlives",
  streamingUrl: "https://www.showroom-live.com/api/live/streaming_url",
  telop: "https://www.showroom-live.com/api/live/telop",
  stageUserList: "https://www.showroom-live.com/api/live/stage_user_list",
  summaryRanking: "https://www.showroom-live.com/api/live/summary_ranking",
  eventAndSupport: "https://www.showroom-live.com/api/room/event_and_support",
  roomProfile: "https://www.showroom-live.com/api/room/profile",
  roomStatus: "https://www.showroom-live.com/api/room/status",
  userProfile: "https://www.showroom-live.com/api/user/profile",
} as const;

export const SHOWROOM_WEB_URL = {
  roomSearch: "https://www.showroom-live.com/room/search",
} as const;

export const SHOWROOM_ORIGIN = "https://www.showroom-live.com";

export async function fetchShowroomJson<T>(url: URL): Promise<T> {
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

export async function fetchShowroomHtml(url: URL): Promise<string> {
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

export function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function toUnixSeconds(value: number | string | null | undefined): number | null {
  return toFiniteNumber(value);
}

export function toLargeImageUrl(imageUrl: string): string {
  return imageUrl.replace("_s.", "_l.").replace("_m.", "_l.");
}
