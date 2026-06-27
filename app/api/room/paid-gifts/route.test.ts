import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getRoomPaidGiftLog: vi.fn(),
}));

vi.mock("@/lib/showroom", () => ({
  getRoomPaidGiftLog: mocks.getRoomPaidGiftLog,
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/room/paid-gifts");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/room/paid-gifts", () => {
  it("room_id がない場合は 400 を返す", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("room_id");
  });

  it("有料ギフトログを返す", async () => {
    const gifts = [{ id: "1", amount: 500 }];
    mocks.getRoomPaidGiftLog.mockResolvedValue(gifts);

    const response = await GET(makeRequest({ room_id: "123" }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { gifts: unknown[] };
    expect(body.gifts).toEqual(gifts);
    expect(mocks.getRoomPaidGiftLog).toHaveBeenCalledWith("123");
  });

  it("上流 API が失敗した場合は 502 を返す", async () => {
    mocks.getRoomPaidGiftLog.mockRejectedValue(new Error("upstream error"));

    const response = await GET(makeRequest({ room_id: "123" }));

    expect(response.status).toBe(502);
  });
});
