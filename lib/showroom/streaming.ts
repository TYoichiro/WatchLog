import { SHOWROOM_API_URL, fetchShowroomJson } from "./core";

type ShowroomStreamingUrlItemRaw = {
  id: number;
  is_default: boolean;
  label: string;
  quality: number;
  type: string;
  url: string;
};

type ShowroomStreamingUrlResponse = {
  streaming_url_list: ShowroomStreamingUrlItemRaw[];
};

export type HlsStreamingUrl = {
  id: number;
  label: string;
  quality: number;
  url: string;
};

export async function getHlsStreamingUrls(
  roomId: number | string
): Promise<HlsStreamingUrl[]> {
  const url = new URL(SHOWROOM_API_URL.streamingUrl);
  url.searchParams.set("room_id", String(roomId));
  url.searchParams.set("abr_available", "1");

  const rawData =
    await fetchShowroomJson<ShowroomStreamingUrlResponse>(url);

  return rawData.streaming_url_list
    .filter((item) => item.type === "hls" || item.type === "hls_all")
    .map((item) => ({
      id: item.id,
      label: item.label,
      quality: item.quality,
      url: item.url,
    }))
    .sort((a, b) => a.quality - b.quality);
}
