import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getRegisteredRoomOwner: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/user-registered-room", () => ({
  getRegisteredRoomOwner: mocks.getRegisteredRoomOwner,
}));

const userId = "user-1";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/registered-room/check");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: userId } });
});

describe("GET /api/registered-room/check", () => {
  it("未認証の場合は 401 を返す", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET(makeRequest({ roomId: "123", roomUrl: "https://example.com/r/test" }));

    expect(response.status).toBe(401);
  });

  it("roomId が欠けている場合は 400 を返す", async () => {
    const response = await GET(makeRequest({ roomUrl: "https://example.com/r/test" }));

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("roomId");
  });

  it("roomUrl が欠けている場合は 400 を返す", async () => {
    const response = await GET(makeRequest({ roomId: "123" }));

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("roomUrl");
  });

  it("他ユーザーが登録済みでない場合は isDuplicate: false を返す", async () => {
    mocks.getRegisteredRoomOwner.mockResolvedValue(null);

    const response = await GET(makeRequest({ roomId: "123", roomUrl: "https://example.com/r/test" }));

    expect(response.status).toBe(200);
    const data = (await response.json()) as { isDuplicate: boolean };
    expect(data.isDuplicate).toBe(false);
    expect(mocks.getRegisteredRoomOwner).toHaveBeenCalledWith(
      userId,
      "123",
      "https://example.com/r/test",
    );
  });

  it("他ユーザーが既に登録済みの場合は isDuplicate: true を返す", async () => {
    mocks.getRegisteredRoomOwner.mockResolvedValue({ userId: "other-user" });

    const response = await GET(makeRequest({ roomId: "123", roomUrl: "https://example.com/r/test" }));

    expect(response.status).toBe(200);
    const data = (await response.json()) as { isDuplicate: boolean };
    expect(data.isDuplicate).toBe(true);
  });
});
