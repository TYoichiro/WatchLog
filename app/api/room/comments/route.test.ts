import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getRoomCommentLog: vi.fn(),
  getOptionalBlockedUserIds: vi.fn(),
  filterBlockedShowroomItems: vi.fn(),
}));

vi.mock("@/lib/showroom", () => ({
  getRoomCommentLog: mocks.getRoomCommentLog,
}));

vi.mock("@/lib/user-blocks", () => ({
  getOptionalBlockedUserIds: mocks.getOptionalBlockedUserIds,
}));

vi.mock("@/lib/showroom-block-filter", () => ({
  filterBlockedShowroomItems: mocks.filterBlockedShowroomItems,
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/room/comments");
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

describe("GET /api/room/comments", () => {
  it("room_id がない場合は 400 を返す", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("room_id");
  });

  it("フィルタリング済みのコメントを返す", async () => {
    const rawComments = [{ id: "1", message: "Hello" }];
    const filtered = [{ id: "1", message: "Hello" }];
    mocks.getRoomCommentLog.mockResolvedValue(rawComments);
    mocks.filterBlockedShowroomItems.mockReturnValue(filtered);

    const response = await GET(makeRequest({ room_id: "123" }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { comments: unknown[] };
    expect(body.comments).toEqual(filtered);
    expect(mocks.getRoomCommentLog).toHaveBeenCalledWith("123");
  });

  it("ブロックユーザーのコメントを除外する", async () => {
    const blockedUserIds = ["blocked-1"];
    mocks.getRoomCommentLog.mockResolvedValue([]);
    mocks.getOptionalBlockedUserIds.mockResolvedValue(blockedUserIds);

    await GET(makeRequest({ room_id: "123" }));

    expect(mocks.filterBlockedShowroomItems).toHaveBeenCalledWith(
      [],
      blockedUserIds
    );
  });

  it("上流 API が失敗した場合は 502 を返す", async () => {
    mocks.getRoomCommentLog.mockRejectedValue(new Error("upstream error"));

    const response = await GET(makeRequest({ room_id: "123" }));

    expect(response.status).toBe(502);
  });
});
