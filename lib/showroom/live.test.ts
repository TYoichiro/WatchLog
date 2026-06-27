import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchShowroomJsonMock } = vi.hoisted(() => ({
  fetchShowroomJsonMock: vi.fn(),
}));

vi.mock("./core", () => ({
  SHOWROOM_API_URL: {
    commentLog: "https://www.showroom-live.com/api/live/comment_log",
    telop: "https://www.showroom-live.com/api/live/telop",
    liveInfo: "https://www.showroom-live.com/api/live/live_info",
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

vi.mock("@/lib/jst", () => ({
  toJstWallTimeDate: () => new Date("2026-06-01T03:00:00.000Z"),
}));

import { getRoomCommentLog, getRoomLiveInfo, getRoomTelop } from "./live";

beforeEach(() => {
  fetchShowroomJsonMock.mockReset();
});

// ---- getRoomCommentLog ----

describe("getRoomCommentLog", () => {
  const baseComment = {
    user_id: 99,
    name: "コメントユーザー",
    comment: "こんにちは！",
    create_at: 1700000000,
    avatar_id: 3,
    avatar_url: "https://example.com/avatar.jpg",
    class_level: 5,
  };

  it("コメントログを正規化して返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ comment_log: [baseComment] });

    const result = await getRoomCommentLog(12345);

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("99");
    expect(result[0].name).toBe("コメントユーザー");
    expect(result[0].text).toBe("こんにちは！");
    expect(result[0].createdAt).toBe(1700000000);
    expect(result[0].avatarId).toBe(3);
    expect(result[0].classLevel).toBe(5);
  });

  it("空のコメントログは空配列を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ comment_log: [] });
    expect(await getRoomCommentLog(12345)).toHaveLength(0);
  });

  it("user_id が null の場合は userId が null になる", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      comment_log: [{ ...baseComment, user_id: null }],
    });
    const [item] = await getRoomCommentLog(12345);
    expect(item.userId).toBeNull();
  });

  it("name が空の場合は 'Unknown' になる", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      comment_log: [{ ...baseComment, name: "" }],
    });
    const [item] = await getRoomCommentLog(12345);
    expect(item.name).toBe("Unknown");
  });

  it("comment が空の場合は空文字になる", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      comment_log: [{ ...baseComment, comment: null }],
    });
    const [item] = await getRoomCommentLog(12345);
    expect(item.text).toBe("");
  });

  it("create_at がない場合は created_at を使う", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      comment_log: [{ ...baseComment, create_at: undefined, created_at: 9999999 }],
    });
    const [item] = await getRoomCommentLog(12345);
    expect(item.createdAt).toBe(9999999);
  });
});

// ---- getRoomTelop ----

describe("getRoomTelop", () => {
  it("テロップ文字列を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ telop: "  テストテロップ  " });
    expect(await getRoomTelop(12345)).toBe("テストテロップ");
  });

  it("telop が null の場合は null を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ telop: null });
    expect(await getRoomTelop(12345)).toBeNull();
  });

  it("telop が空文字の場合は null を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ telop: "   " });
    expect(await getRoomTelop(12345)).toBeNull();
  });
});

// ---- getRoomLiveInfo ----

describe("getRoomLiveInfo", () => {
  it("通常配信情報を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      bcsvr_key: "abc:123",
      live_id: 456,
      live_status: 2,
      redirect_url: null,
    });

    const result = await getRoomLiveInfo(12345);

    expect(result.bcsvrKey).toBe("abc:123");
    expect(result.liveId).toBe("456");
    expect(result.liveStatus).toBe(2);
    expect(result.isPremiumLive).toBe(false);
  });

  it("redirect_url があるとプレミアム配信として扱う", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      redirect_url: "https://premium.example.com/live",
      live_id: null,
      bcsvr_key: "should-be-ignored",
    });

    const result = await getRoomLiveInfo(12345);

    expect(result.isPremiumLive).toBe(true);
    expect(result.bcsvrKey).toBeNull();
    expect(result.liveStatus).toBeNull();
  });

  it("プレミアム配信の場合 live_id が null ならば日付フォールバックを使う", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      redirect_url: "https://premium.example.com/live",
      live_id: null,
    });

    const result = await getRoomLiveInfo(12345);
    expect(result.liveId).toMatch(/^\d{8}$/);
  });

  it("bcsvr_key が空の場合は null になる", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      bcsvr_key: "  ",
      live_id: 1,
      redirect_url: null,
    });

    const result = await getRoomLiveInfo(12345);
    expect(result.bcsvrKey).toBeNull();
  });

  it("API が失敗した場合はエラーを伝播する", async () => {
    fetchShowroomJsonMock.mockRejectedValue(new Error("Showroom API request failed: 500"));
    await expect(getRoomLiveInfo(12345)).rejects.toThrow();
  });
});
