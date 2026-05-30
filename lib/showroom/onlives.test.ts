import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchShowroomJsonMock } = vi.hoisted(() => ({
  fetchShowroomJsonMock: vi.fn(),
}));

vi.mock("./core", () => ({
  SHOWROOM_API_URL: {
    onlives: "https://www.showroom-live.com/api/live/onlives",
  },
  fetchShowroomJson: fetchShowroomJsonMock,
}));

import { getOnlives } from "./onlives";

const rawResponse = {
  onlives: [
    {
      genre_id: 102,
      genre_name: "アイドル",
      has_upcoming: false,
      banners: [{ url: "https://example.com/banner", image: "https://example.com/banner.png" }],
      lives: [
        {
          room_id: 150710,
          room_url_key: "JOY_OZAWA_AIMI",
          main_name: "小澤 愛実（≒JOY）",
          image: "https://example.com/cover.png",
          image_square: "https://example.com/cover_square.png",
          view_num: 9401,
          follower_num: 36988,
          started_at: 1779198243,
          live_id: 22925457,
          genre_id: 102,
          genre_name: "アイドル",
          badge_list: [{ image_url: "https://example.com/badge.png", type: "show_grade", id: 1 }],
          streaming_url_list: [
            {
              is_default: true,
              url: "https://example.com/stream.m3u8",
              label: "low quality",
              type: "hls",
              id: 4,
              quality: 100,
            },
          ],
          bcsvr_key: "abc:22925457",
          cell_type: 100,
          official_lv: 1,
          live_type: 0,
          is_follow: true,
          tags: ["tag1"],
          telop: "テロップ",
          liver_theme_title: "テーマ",
          everyday_live_label: "まいにち 100 days",
          genre_ranking_rank: 0,
          is_karaoke: false,
          premium_room_type: 0,
          frame_image_url: "https://example.com/frame.png",
          frame_lottie_url: "https://example.com/lottie.json",
        },
      ],
    },
    {
      genre_id: 200,
      genre_name: "ライバー",
      has_upcoming: true,
      lives: [],
    },
  ],
};

beforeEach(() => {
  fetchShowroomJsonMock.mockReset();
});

describe("getOnlives", () => {
  it("onlives API の URL に対してリクエストを送る", async () => {
    fetchShowroomJsonMock.mockResolvedValue(rawResponse);

    await getOnlives();

    const calledUrl: URL = fetchShowroomJsonMock.mock.calls[0][0];
    expect(calledUrl.toString()).toBe("https://www.showroom-live.com/api/live/onlives");
  });

  it("レスポンスをキャメルケースに変換して返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue(rawResponse);

    const result = await getOnlives();

    expect(result.onlives).toHaveLength(2);

    const idol = result.onlives[0];
    expect(idol.genreId).toBe(102);
    expect(idol.genreName).toBe("アイドル");
    expect(idol.hasUpcoming).toBe(false);
    expect(idol.banners).toEqual([{ url: "https://example.com/banner", image: "https://example.com/banner.png" }]);
    expect(idol.lives).toHaveLength(1);

    const live = idol.lives[0];
    expect(live.roomId).toBe(150710);
    expect(live.roomUrlKey).toBe("JOY_OZAWA_AIMI");
    expect(live.mainName).toBe("小澤 愛実（≒JOY）");
    expect(live.imageSquare).toBe("https://example.com/cover_square.png");
    expect(live.viewNum).toBe(9401);
    expect(live.followerNum).toBe(36988);
    expect(live.startedAt).toBe(1779198243);
    expect(live.liveId).toBe(22925457);
    expect(live.bcsvrKey).toBe("abc:22925457");
    expect(live.cellType).toBe(100);
    expect(live.officialLv).toBe(1);
    expect(live.liveType).toBe(0);
    expect(live.isFollow).toBe(true);
    expect(live.tags).toEqual(["tag1"]);
    expect(live.telop).toBe("テロップ");
    expect(live.liverThemeTitle).toBe("テーマ");
    expect(live.everydayLiveLabel).toBe("まいにち 100 days");
    expect(live.isKaraoke).toBe(false);
    expect(live.frameImageUrl).toBe("https://example.com/frame.png");
    expect(live.frameLottieUrl).toBe("https://example.com/lottie.json");

    expect(live.badgeList).toEqual([
      { imageUrl: "https://example.com/badge.png", type: "show_grade", id: 1 },
    ]);
    expect(live.streamingUrlList).toEqual([
      {
        isDefault: true,
        url: "https://example.com/stream.m3u8",
        label: "low quality",
        id: 4,
        quality: 100,
      },
    ]);
  });

  it("オプショナルフィールドが欠如している場合は null / false にフォールバックする", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      onlives: [
        {
          genre_id: 102,
          genre_name: "アイドル",
          has_upcoming: false,
          lives: [
            {
              room_id: 1,
              room_url_key: "test",
              main_name: "テスト",
              image: "https://example.com/img.jpg",
              view_num: 100,
              follower_num: 200,
              started_at: 1000000,
              live_id: 1,
              genre_id: 102,
              genre_name: "アイドル",
              badge_list: [],
              streaming_url_list: [],
              bcsvr_key: "key:1",
              liver_theme_title: "",
              genre_ranking_rank: 0,
              premium_room_type: 0,
            },
          ],
        },
      ],
    });

    const result = await getOnlives();
    const genre = result.onlives[0];
    const live = genre.lives[0];

    expect(genre.banners).toEqual([]);
    expect(live.imageSquare).toBeNull();
    expect(live.bcsvrKey).toBe("key:1");
    expect(live.cellType).toBeNull();
    expect(live.officialLv).toBeNull();
    expect(live.liveType).toBeNull();
    expect(live.isFollow).toBe(false);
    expect(live.tags).toEqual([]);
    expect(live.telop).toBeNull();
    expect(live.everydayLiveLabel).toBeNull();
    expect(live.isKaraoke).toBe(false);
    expect(live.frameImageUrl).toBeNull();
    expect(live.frameLottieUrl).toBeNull();
  });

  it("API が失敗した場合はエラーをそのまま伝播する", async () => {
    fetchShowroomJsonMock.mockRejectedValue(new Error("Showroom API request failed: 500"));

    await expect(getOnlives()).rejects.toThrow("Showroom API request failed: 500");
  });
});
