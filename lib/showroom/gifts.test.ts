import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchShowroomJsonMock, fetchMock } = vi.hoisted(() => ({
  fetchShowroomJsonMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("./core", () => ({
  SHOWROOM_API_URL: {
    giftGroups: "https://www.showroom-live.com/api/live/gift_groups",
    giftLog: "https://www.showroom-live.com/api/live/gift_log",
  },
  SHOWROOM_HEADERS: {},
  fetchShowroomJson: fetchShowroomJsonMock,
  toFiniteNumber: (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.length > 0) {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  },
  toUnixSeconds: (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.length > 0) {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  },
}));

import { getRoomGiftDefinitions, getRoomGiftLog, getRoomPaidGiftLog } from "./gifts";

beforeEach(() => {
  fetchShowroomJsonMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeGiftGroupsResponse = (overrides = {}) => ({
  gift_groups: [
    {
      gift_list: [
        {
          gift_id: 1001,
          gift_name: "有料ギフト",
          image: "https://example.com/gift.png",
          point: 100,
          free: false,
        },
      ],
    },
  ],
  ...overrides,
});

const makeGiftLogResponse = () => ({
  gift_log: [
    {
      gift_id: 10001,
      name: "テストユーザー",
      num: 3,
      created_at: 1700000000,
      user_id: 99,
      avatar_id: 5,
      avatar_url: "https://example.com/avatar.jpg",
      image: "https://example.com/user.jpg",
      image2: null,
      ua: 2,
    },
  ],
});

// gift_groups のフェッチは fetch() 経由、gift_log は fetchShowroomJson 経由
function mockGiftGroupsFetch(data: unknown, ok = true) {
  fetchMock.mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  });
}

describe("getRoomGiftDefinitions", () => {
  it("ギフト定義一覧を返す（無料ギフト + API ギフト）", async () => {
    mockGiftGroupsFetch(makeGiftGroupsResponse());

    const result = await getRoomGiftDefinitions(12345);

    expect(result.length).toBeGreaterThan(0);
    const paid = result.find((g) => g.giftId === 1001);
    expect(paid).toBeDefined();
    expect(paid!.isFree).toBe(false);
    expect(paid!.point).toBe(100);
  });

  it("無料ギフト（ID 10001）が含まれる", async () => {
    mockGiftGroupsFetch(makeGiftGroupsResponse());

    const result = await getRoomGiftDefinitions(12345);
    const free = result.find((g) => g.giftId === 10001);
    expect(free).toBeDefined();
    expect(free!.isFree).toBe(true);
    expect(free!.point).toBe(0);
  });

  it("gift_groups が null の場合は無料ギフトのみ返す", async () => {
    mockGiftGroupsFetch({ gift_groups: null });

    const result = await getRoomGiftDefinitions(12345);
    expect(result.every((g) => g.isFree === true)).toBe(true);
  });
});

describe("getRoomGiftLog", () => {
  it("ギフトログを正規化して返す", async () => {
    mockGiftGroupsFetch(makeGiftGroupsResponse());
    fetchShowroomJsonMock.mockResolvedValue(makeGiftLogResponse());

    const result = await getRoomGiftLog(12345);

    expect(result.length).toBeGreaterThan(0);
    const item = result[0];
    expect(item.count).toBe(3);
    expect(item.userId).toBe("99");
    expect(item.userName).toBe("テストユーザー");
    expect(item.createdAt).toBe(1700000000);
  });

  it("無料ギフト（ID 10001）は isFree が true", async () => {
    mockGiftGroupsFetch({});
    fetchShowroomJsonMock.mockResolvedValue(makeGiftLogResponse());

    const result = await getRoomGiftLog(12345);
    expect(result[0].isFree).toBe(true);
  });

  it("同じユーザーの同じギフトが 30 秒以内なら集計される", async () => {
    mockGiftGroupsFetch({});
    fetchShowroomJsonMock.mockResolvedValue({
      gift_log: [
        { gift_id: 10001, user_id: 99, num: 1, created_at: 1000000 },
        { gift_id: 10001, user_id: 99, num: 2, created_at: 1000010 },
      ],
    });

    const result = await getRoomGiftLog(12345);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });

  it("30 秒を超えた場合は別エントリになる", async () => {
    mockGiftGroupsFetch({});
    fetchShowroomJsonMock.mockResolvedValue({
      gift_log: [
        { gift_id: 10001, user_id: 99, num: 1, created_at: 1000000 },
        { gift_id: 10001, user_id: 99, num: 1, created_at: 1000031 },
      ],
    });

    const result = await getRoomGiftLog(12345);
    expect(result).toHaveLength(2);
  });

  it("user_id が null のギフトは集計されない", async () => {
    mockGiftGroupsFetch({});
    fetchShowroomJsonMock.mockResolvedValue({
      gift_log: [
        { gift_id: 10001, user_id: null, num: 1, created_at: 1000 },
        { gift_id: 10001, user_id: null, num: 1, created_at: 1001 },
      ],
    });

    const result = await getRoomGiftLog(12345);
    expect(result).toHaveLength(2);
  });
});

describe("getRoomPaidGiftLog", () => {
  it("isFree が false のギフトのみ返す", async () => {
    mockGiftGroupsFetch(makeGiftGroupsResponse());
    fetchShowroomJsonMock.mockResolvedValue({
      gift_log: [
        { gift_id: 10001, user_id: 1, num: 1, created_at: 1000 },
        { gift_id: 1001, user_id: 2, num: 1, created_at: 1000 },
      ],
    });

    const result = await getRoomPaidGiftLog(12345);
    expect(result.every((g) => g.isFree === false)).toBe(true);
  });
});
