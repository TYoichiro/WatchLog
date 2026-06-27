import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchShowroomJsonMock } = vi.hoisted(() => ({
  fetchShowroomJsonMock: vi.fn(),
}));

vi.mock("./core", () => ({
  SHOWROOM_API_URL: {
    stageUserList: "https://www.showroom-live.com/api/live/stage_user_list",
    summaryRanking: "https://www.showroom-live.com/api/live/summary_ranking",
  },
  fetchShowroomJson: fetchShowroomJsonMock,
  toFiniteNumber: (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.length > 0) {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  },
}));

import { getRoomLiveRanking, getRoomTotalRanking } from "./ranking";

beforeEach(() => {
  fetchShowroomJsonMock.mockReset();
});

// ---- getRoomLiveRanking ----

describe("getRoomLiveRanking", () => {
  const baseItem = {
    order_no: 1,
    rank: 1,
    user: {
      user_id: 99,
      name: "テストユーザー",
      avatar_id: 10,
      avatar_url: "https://example.com/avatar.jpg",
      image: "https://example.com/user.jpg",
      badge: 3,
      badge_type: 1,
      ua: 5,
    },
  };

  it("stage_user_list を正規化して返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ stage_user_list: [baseItem] });

    const result = await getRoomLiveRanking(12345);

    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
    expect(result[0].userId).toBe("99");
    expect(result[0].userName).toBe("テストユーザー");
    expect(result[0].avatarId).toBe(10);
    expect(result[0].badge).toBe(3);
    expect(result[0].badgeType).toBe(1);
    expect(result[0].userVisitStatus).toBe(5);
    expect(result[0].userImageUrl).toBe("https://example.com/user.jpg");
  });

  it("stage_user_list が空の場合は空配列を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ stage_user_list: [] });
    expect(await getRoomLiveRanking(12345)).toHaveLength(0);
  });

  it("stage_user_list が null の場合は空配列を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ stage_user_list: null });
    expect(await getRoomLiveRanking(12345)).toHaveLength(0);
  });

  it("user が null の場合のフォールバック", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      stage_user_list: [{ order_no: 1, rank: 1, user: null }],
    });
    const result = await getRoomLiveRanking(12345);
    expect(result[0].userId).toBeNull();
    expect(result[0].userName).toBe("Unknown");
    expect(result[0].avatarId).toBeNull();
    expect(result[0].badge).toBeNull();
  });

  it("rank が null の場合は order_no を使う", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      stage_user_list: [{ order_no: 5, rank: null, user: { user_id: 1 } }],
    });
    const [item] = await getRoomLiveRanking(12345);
    expect(item.rank).toBe(5);
  });

  it("rank も order_no もない場合は index + 1 を使う", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      stage_user_list: [{ user: { user_id: 1 } }, { user: { user_id: 2 } }],
    });
    const result = await getRoomLiveRanking(12345);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  it("API が失敗した場合はエラーを伝播する", async () => {
    fetchShowroomJsonMock.mockRejectedValue(new Error("Showroom API request failed: 500"));
    await expect(getRoomLiveRanking(12345)).rejects.toThrow();
  });
});

// ---- getRoomTotalRanking ----

describe("getRoomTotalRanking", () => {
  const baseItem = {
    rank: 1,
    order: 1,
    user_id: 42,
    name: "上位ユーザー",
    avatar_id: 5,
    avatar_url: "https://example.com/avatar.jpg",
    point: 5000,
    ua: 3,
    visit_count: 10,
  };

  it("summary_ranking を正規化して返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ ranking: [baseItem] });

    const result = await getRoomTotalRanking(12345);

    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
    expect(result[0].userId).toBe("42");
    expect(result[0].userName).toBe("上位ユーザー");
    expect(result[0].point).toBe(5000);
    expect(result[0].visitCount).toBe(10);
    expect(result[0].userVisitStatus).toBe(3);
  });

  it("ranking が null の場合は空配列を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ ranking: null });
    expect(await getRoomTotalRanking(12345)).toHaveLength(0);
  });

  it("point が null の場合は 0 になる", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      ranking: [{ ...baseItem, point: null }],
    });
    const [item] = await getRoomTotalRanking(12345);
    expect(item.point).toBe(0);
  });

  it("user_id が null の場合は userId が null になる", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      ranking: [{ ...baseItem, user_id: null }],
    });
    const [item] = await getRoomTotalRanking(12345);
    expect(item.userId).toBeNull();
  });

  it("name が空の場合は 'Unknown' になる", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      ranking: [{ ...baseItem, name: "" }],
    });
    const [item] = await getRoomTotalRanking(12345);
    expect(item.userName).toBe("Unknown");
  });
});
