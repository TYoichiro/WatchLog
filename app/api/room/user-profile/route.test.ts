import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getRoomUserProfile: vi.fn(),
}));

vi.mock("@/lib/showroom", () => ({
  getRoomUserProfile: mocks.getRoomUserProfile,
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/room/user-profile");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/room/user-profile", () => {
  it("room_id がない場合は 400 を返す", async () => {
    const response = await GET(makeRequest({ user_id: "456" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("room_id");
  });

  it("user_id がない場合は 400 を返す", async () => {
    const response = await GET(makeRequest({ room_id: "123" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("user_id");
  });

  it("ユーザープロフィールを返す", async () => {
    const profile = { userId: "456", name: "Test User" };
    mocks.getRoomUserProfile.mockResolvedValue(profile);

    const response = await GET(makeRequest({ room_id: "123", user_id: "456" }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { profile: unknown };
    expect(body.profile).toEqual(profile);
    expect(mocks.getRoomUserProfile).toHaveBeenCalledWith("123", "456");
  });

  it("上流 API が失敗した場合は 502 を返す", async () => {
    mocks.getRoomUserProfile.mockRejectedValue(new Error("upstream error"));

    const response = await GET(makeRequest({ room_id: "123", user_id: "456" }));

    expect(response.status).toBe(502);
  });
});
