import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchShowroomJsonMock } = vi.hoisted(() => ({
  fetchShowroomJsonMock: vi.fn(),
}));

vi.mock("./core", () => ({
  SHOWROOM_API_URL: {
    streamingUrl: "https://www.showroom-live.com/api/live/streaming_url",
  },
  fetchShowroomJson: fetchShowroomJsonMock,
}));

import { getHlsStreamingUrls } from "./streaming";

beforeEach(() => {
  fetchShowroomJsonMock.mockReset();
});

const makeStreamingUrlList = (items: object[]) => ({ streaming_url_list: items });

describe("getHlsStreamingUrls", () => {
  it("hls タイプの URL を quality 昇順で返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue(
      makeStreamingUrlList([
        { id: 1, is_default: false, label: "high", quality: 200, type: "hls", url: "https://example.com/high.m3u8" },
        { id: 2, is_default: true, label: "low", quality: 100, type: "hls", url: "https://example.com/low.m3u8" },
      ])
    );

    const result = await getHlsStreamingUrls(12345);

    expect(result).toHaveLength(2);
    expect(result[0].quality).toBe(100);
    expect(result[1].quality).toBe(200);
    expect(result[0].url).toBe("https://example.com/low.m3u8");
  });

  it("hls_all タイプも含める", async () => {
    fetchShowroomJsonMock.mockResolvedValue(
      makeStreamingUrlList([
        { id: 1, is_default: true, label: "hls_all", quality: 50, type: "hls_all", url: "https://example.com/all.m3u8" },
      ])
    );

    const result = await getHlsStreamingUrls(12345);
    expect(result).toHaveLength(1);
  });

  it("hls / hls_all 以外のタイプは除外する", async () => {
    fetchShowroomJsonMock.mockResolvedValue(
      makeStreamingUrlList([
        { id: 1, is_default: true, label: "rtmp", quality: 100, type: "rtmp", url: "rtmp://example.com/live" },
        { id: 2, is_default: false, label: "hls", quality: 200, type: "hls", url: "https://example.com/hls.m3u8" },
      ])
    );

    const result = await getHlsStreamingUrls(12345);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("hls");
  });

  it("空リストの場合は空配列を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue(makeStreamingUrlList([]));
    expect(await getHlsStreamingUrls(12345)).toHaveLength(0);
  });

  it("id / label / quality / url のみ含む（is_default は除外）", async () => {
    fetchShowroomJsonMock.mockResolvedValue(
      makeStreamingUrlList([
        { id: 7, is_default: true, label: "test", quality: 150, type: "hls", url: "https://example.com/test.m3u8" },
      ])
    );

    const result = await getHlsStreamingUrls(12345);
    expect(result[0]).toEqual({ id: 7, label: "test", quality: 150, url: "https://example.com/test.m3u8" });
    expect(result[0]).not.toHaveProperty("is_default");
  });

  it("API が失敗した場合はエラーを伝播する", async () => {
    fetchShowroomJsonMock.mockRejectedValue(new Error("Showroom API request failed: 500"));
    await expect(getHlsStreamingUrls(12345)).rejects.toThrow();
  });

  it("room_id パラメーターを URL に含めてリクエストする", async () => {
    fetchShowroomJsonMock.mockResolvedValue(makeStreamingUrlList([]));
    await getHlsStreamingUrls(12345);
    const url: URL = fetchShowroomJsonMock.mock.calls[0][0];
    expect(url.searchParams.get("room_id")).toBe("12345");
    expect(url.searchParams.get("abr_available")).toBe("1");
  });
});
