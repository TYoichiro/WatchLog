import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getRoomLiveRanking: vi.fn(),
  getOptionalBlockedUserIds: vi.fn(),
  filterBlockedShowroomItems: vi.fn(),
}));

vi.mock("@/lib/showroom", () => ({
  getRoomLiveRanking: mocks.getRoomLiveRanking,
}));

vi.mock("@/lib/user-blocks", () => ({
  getOptionalBlockedUserIds: mocks.getOptionalBlockedUserIds,
}));

vi.mock("@/lib/showroom-block-filter", () => ({
  filterBlockedShowroomItems: mocks.filterBlockedShowroomItems,
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/room/live-ranking");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOptionalBlockedUserIds.mockResolvedValue([]);
  mocks.filterBlockedShowroomItems.mockImplementation((items: unknown[]) => items);
});

describe("GET /api/room/live-ranking", () => {
  it("room_id がない場合は 400 を返す", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("room_id");
  });

  it("フィルタリング済みのランキングを返す", async () => {
    const rawRanking = [{ rank: 1, userId: "u1" }];
    const filtered = [{ rank: 1, userId: "u1" }];
    mocks.getRoomLiveRanking.mockResolvedValue(rawRanking);
    mocks.filterBlockedShowroomItems.mockReturnValue(filtered);

    const response = await GET(makeRequest({ room_id: "123" }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ranking: unknown[] };
    expect(body.ranking).toEqual(filtered);
    expect(mocks.getRoomLiveRanking).toHaveBeenCalledWith("123");
  });

  it("ブロックユーザーをランキングから除外する", async () => {
    const blockedUserIds = ["blocked-1"];
    mocks.getRoomLiveRanking.mockResolvedValue([]);
    mocks.getOptionalBlockedUserIds.mockResolvedValue(blockedUserIds);

    await GET(makeRequest({ room_id: "123" }));

    expect(mocks.filterBlockedShowroomItems).toHaveBeenCalledWith(
      [],
      blockedUserIds
    );
  });

  it("上流 API が失敗した場合は 502 を返す", async () => {
    mocks.getRoomLiveRanking.mockRejectedValue(new Error("upstream error"));

    const response = await GET(makeRequest({ room_id: "123" }));

    expect(response.status).toBe(502);
  });
});
