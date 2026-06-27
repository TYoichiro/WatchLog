import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getRoomLiveInfo: vi.fn(),
  getUserRegisteredRoom: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
  },
}));

vi.mock("@/lib/showroom", () => ({
  getRoomLiveInfo: mocks.getRoomLiveInfo,
}));

vi.mock("@/lib/user-registered-room", () => ({
  getUserRegisteredRoom: mocks.getUserRegisteredRoom,
}));

const liveInfo = {
  bcsvrKey: "bcsvr-key",
  liveId: "live-123",
  liveStatus: 2,
};

const registeredRoom = {
  imageUrl: null,
  roomId: "123",
  roomName: "Alpha Room",
  roomUrl: "alpha-room",
};

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/live/liveinfo");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.getRoomLiveInfo.mockResolvedValue(liveInfo);
  mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
});

describe("GET /api/live/liveinfo", () => {
  describe("バリデーション", () => {
    it("room_id がない場合は 400 を返す", async () => {
      const response = await GET(makeRequest());

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("room_id is required");
    });
  });

  describe("ライブ情報取得", () => {
    it("liveInfo を返す", async () => {
      const response = await GET(makeRequest({ room_id: "123" }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(liveInfo);
    });

    it("getRoomLiveInfo を room_id で呼び出す", async () => {
      await GET(makeRequest({ room_id: "123" }));

      expect(mocks.getRoomLiveInfo).toHaveBeenCalledWith("123");
    });

    it("上流 API が失敗した場合は 502 を返す", async () => {
      mocks.getRoomLiveInfo.mockRejectedValue(new Error("upstream error"));

      const response = await GET(makeRequest({ room_id: "123" }));

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.error).toBe("Failed to fetch upstream API");
    });
  });

  describe("ログ出力", () => {
    it("initial=1 かつ配信中（liveStatus !== 1）かつログインしている場合はロガーを呼び出す", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

      const response = await GET(makeRequest({ room_id: "123", initial: "1" }));

      expect(response.status).toBe(200);
      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        "オンライブ画面: 配信中のルーム",
        expect.objectContaining({
          userId: "user-1",
          roomId: "123",
        })
      );
    });

    it("initial=1 かつ liveStatus === 1 の場合はロガーを呼ばない", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
      mocks.getRoomLiveInfo.mockResolvedValue({ ...liveInfo, liveStatus: 1 });

      await GET(makeRequest({ room_id: "123", initial: "1" }));

      expect(mocks.loggerInfo).not.toHaveBeenCalled();
    });

    it("initial=1 かつ liveStatus === null の場合はロガーを呼ばない", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
      mocks.getRoomLiveInfo.mockResolvedValue({ ...liveInfo, liveStatus: null });

      await GET(makeRequest({ room_id: "123", initial: "1" }));

      expect(mocks.loggerInfo).not.toHaveBeenCalled();
    });

    it("initial パラメーターがない場合はロガーを呼ばない", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

      await GET(makeRequest({ room_id: "123" }));

      expect(mocks.loggerInfo).not.toHaveBeenCalled();
    });

    it("未認証の場合はロガーを呼ばない", async () => {
      mocks.auth.mockResolvedValue(null);

      await GET(makeRequest({ room_id: "123", initial: "1" }));

      expect(mocks.loggerInfo).not.toHaveBeenCalled();
      expect(mocks.getUserRegisteredRoom).not.toHaveBeenCalled();
    });

    it("roomUrl が null のルームの場合は roomUrl: null でロガーを呼び出す", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
      mocks.getUserRegisteredRoom.mockResolvedValue(null);

      await GET(makeRequest({ room_id: "123", initial: "1" }));

      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        "オンライブ画面: 配信中のルーム",
        expect.objectContaining({ roomUrl: null })
      );
    });
  });
});
