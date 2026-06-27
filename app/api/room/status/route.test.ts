import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getRoomStatus: vi.fn(),
}));

vi.mock("@/lib/showroom", () => ({
  getRoomStatus: mocks.getRoomStatus,
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/room/status");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/room/status", () => {
  it("room_url_key がない場合は 400 を返す", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("room_url_key");
  });

  it("ルームステータスを返す", async () => {
    const data = { isLive: true, viewerCount: 100 };
    mocks.getRoomStatus.mockResolvedValue(data);

    const response = await GET(makeRequest({ room_url_key: "test_room" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(data);
    expect(mocks.getRoomStatus).toHaveBeenCalledWith("test_room");
  });

  it("上流 API が失敗した場合は 502 を返す", async () => {
    mocks.getRoomStatus.mockRejectedValue(new Error("upstream error"));

    const response = await GET(makeRequest({ room_url_key: "test_room" }));

    expect(response.status).toBe(502);
  });
});
