import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getRoomActiveFan: vi.fn(),
}));

vi.mock("@/lib/showroom", () => ({
  getRoomActiveFan: mocks.getRoomActiveFan,
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/room/activefan");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/room/activefan", () => {
  it("room_id がない場合は 400 を返す", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("room_id");
  });

  it("アクティブファンデータを返す", async () => {
    const data = { fans: [{ id: "1", name: "Fan" }] };
    mocks.getRoomActiveFan.mockResolvedValue(data);

    const response = await GET(makeRequest({ room_id: "123" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(data);
    expect(mocks.getRoomActiveFan).toHaveBeenCalledWith("123");
  });

  it("上流 API が失敗した場合は 502 を返す", async () => {
    mocks.getRoomActiveFan.mockRejectedValue(new Error("upstream error"));

    const response = await GET(makeRequest({ room_id: "123" }));

    expect(response.status).toBe(502);
  });
});
