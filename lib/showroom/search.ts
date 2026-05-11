import {
  SHOWROOM_ORIGIN,
  SHOWROOM_WEB_URL,
  fetchShowroomHtml,
} from "./core";

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

export type RoomSearchResult = {
  imageUrl: string;
  roomId: string;
  roomName: string;
  roomUrl: string;
};

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
