import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  searchShowroomRooms: vi.fn(),
}));

vi.mock("@/lib/showroom", () => ({
  searchShowroomRooms: mocks.searchShowroomRooms,
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/room/search");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/room/search", () => {
  it("keyword がない場合は 400 を返す", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("keyword");
  });

  it("空白のみの keyword は 400 を返す", async () => {
    const response = await GET(makeRequest({ keyword: "   " }));

    expect(response.status).toBe(400);
  });

  it("検索結果を返す", async () => {
    const rooms = [{ id: 1, name: "Room A" }];
    mocks.searchShowroomRooms.mockResolvedValue(rooms);

    const response = await GET(makeRequest({ keyword: "test" }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { rooms: unknown[] };
    expect(body.rooms).toEqual(rooms);
    expect(mocks.searchShowroomRooms).toHaveBeenCalledWith("test");
  });

  it("keyword の前後の空白をトリムして検索する", async () => {
    mocks.searchShowroomRooms.mockResolvedValue([]);

    await GET(makeRequest({ keyword: "  test  " }));

    expect(mocks.searchShowroomRooms).toHaveBeenCalledWith("test");
  });

  it("上流 API が失敗した場合は 502 を返す", async () => {
    mocks.searchShowroomRooms.mockRejectedValue(new Error("upstream error"));

    const response = await GET(makeRequest({ keyword: "test" }));

    expect(response.status).toBe(502);
  });
});
