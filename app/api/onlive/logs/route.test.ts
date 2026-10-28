import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getUserRoles: vi.fn(),
  saveOnliveLog: vi.fn(),
  filterBlockedShowroomItems: vi.fn(),
  parseJstWallTime: vi.fn(),
  toJstIsoString: vi.fn(),
  toJstWallTimeIsoString: vi.fn(),
  getRoomTotalRanking: vi.fn(),
  getCachedBlockedShowroomUserIds: vi.fn(),
  getUserRegisteredRoom: vi.fn(),
  extractRoomUserCommentsFromLog: vi.fn(),
  upsertRoomUserLastComments: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/authz", () => ({
  getUserRoles: mocks.getUserRoles,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/onlive-log", () => ({
  saveOnliveLog: mocks.saveOnliveLog,
}));

vi.mock("@/lib/room-user-last-comment", () => ({
  extractRoomUserCommentsFromLog: mocks.extractRoomUserCommentsFromLog,
  upsertRoomUserLastComments: mocks.upsertRoomUserLastComments,
}));

vi.mock("@/lib/showroom-block-filter", () => ({
  filterBlockedShowroomItems: mocks.filterBlockedShowroomItems,
}));

vi.mock("@/lib/jst", () => ({
  parseJstWallTime: mocks.parseJstWallTime,
  toJstIsoString: mocks.toJstIsoString,
  toJstWallTimeIsoString: mocks.toJstWallTimeIsoString,
}));

vi.mock("@/lib/showroom", () => ({
  getRoomTotalRanking: mocks.getRoomTotalRanking,
}));

vi.mock("@/lib/user-blocks", () => ({
  getCachedBlockedShowroomUserIds: mocks.getCachedBlockedShowroomUserIds,
}));

vi.mock("@/lib/user-registered-room", () => ({
  getUserRegisteredRoom: mocks.getUserRegisteredRoom,
}));

const capturedAtDate = new Date("2026-06-27T12:00:00.000Z");

const registeredRoom = {
  imageUrl: null,
  roomId: "room-123",
  roomName: "Test Room",
  roomUrl: "test-room",
};

const savedLog = {
  id: "log-1",
  capturedAt: capturedAtDate,
  liveId: "live-abc",
  log: {},
  roomId: "room-123",
  title: null,
  updatedAt: capturedAtDate,
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/onlive/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  roomId: "room-123",
  liveId: "live-abc",
  capturedAt: "2026-06-27T21:00:00",
  log: { comments: [], gifts: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: true });
  mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
  mocks.parseJstWallTime.mockReturnValue(capturedAtDate);
  mocks.toJstIsoString.mockReturnValue("2026-06-27T21:00:00.000+09:00");
  mocks.toJstWallTimeIsoString.mockReturnValue("2026-06-27T21:00:00.000+09:00");
  mocks.getRoomTotalRanking.mockResolvedValue([]);
  mocks.getCachedBlockedShowroomUserIds.mockResolvedValue([]);
  mocks.filterBlockedShowroomItems.mockReturnValue([]);
  mocks.saveOnliveLog.mockResolvedValue(savedLog);
  mocks.extractRoomUserCommentsFromLog.mockReturnValue([]);
  mocks.upsertRoomUserLastComments.mockResolvedValue(undefined);
});

describe("POST /api/onlive/logs", () => {
  describe("認証", () => {
    it("未認証の場合は 401 を返す", async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("session に user.id がない場合は 401 を返す", async () => {
      mocks.auth.mockResolvedValue({ user: {} });

      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(401);
    });
  });

  describe("リクエストボディのバリデーション", () => {
    it("不正な JSON の場合は 400 を返す", async () => {
      const request = new NextRequest("http://localhost/api/onlive/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid JSON body");
    });

    it("roomId が欠けている場合は 400 を返す", async () => {
      mocks.parseJstWallTime.mockReturnValue(capturedAtDate);
      const response = await POST(
        makeRequest({ ...validBody, roomId: undefined })
      );

      expect(response.status).toBe(400);
    });

    it("liveId が欠けている場合は 400 を返す", async () => {
      const response = await POST(
        makeRequest({ ...validBody, liveId: undefined })
      );

      expect(response.status).toBe(400);
    });

    it("capturedAt が無効な場合は 400 を返す", async () => {
      mocks.parseJstWallTime.mockReturnValue(null);
      const response = await POST(
        makeRequest({ ...validBody, capturedAt: "invalid-date" })
      );

      expect(response.status).toBe(400);
    });

    it("log がオブジェクトでない場合は 400 を返す", async () => {
      const response = await POST(
        makeRequest({ ...validBody, log: "not-an-object" })
      );

      expect(response.status).toBe(400);
    });

    it("空白のみの roomId は 400 を返す", async () => {
      const response = await POST(
        makeRequest({ ...validBody, roomId: "   " })
      );

      expect(response.status).toBe(400);
    });
  });

  describe("認可", () => {
    it("登録ルームがない場合は 403 を返す", async () => {
      mocks.getUserRegisteredRoom.mockResolvedValue(null);

      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(403);
    });

    it("登録ルームの roomId が一致しない場合は 403 を返す", async () => {
      mocks.getUserRegisteredRoom.mockResolvedValue({
        ...registeredRoom,
        roomId: "different-room",
      });

      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(403);
    });

    it("プレミアムでない場合は 403 を返す", async () => {
      mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: false });

      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(403);
    });
  });

  describe("ログ保存", () => {
    it("保存したログを返す", async () => {
      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.log).toMatchObject({
        id: "log-1",
        liveId: "live-abc",
        roomId: "room-123",
      });
    });

    it("saveOnliveLog を正しい引数で呼び出す", async () => {
      await POST(makeRequest(validBody));

      expect(mocks.saveOnliveLog).toHaveBeenCalledWith(
        expect.objectContaining({
          capturedAt: capturedAtDate,
          liveId: "live-abc",
          roomId: "room-123",
        })
      );
    });

    it("ランキングとブロックユーザーを並列取得する", async () => {
      await POST(makeRequest(validBody));

      expect(mocks.getRoomTotalRanking).toHaveBeenCalledWith("room-123");
      expect(mocks.getCachedBlockedShowroomUserIds).toHaveBeenCalledWith("user-1");
    });

    it("ランキング取得失敗時もログを保存する", async () => {
      mocks.getRoomTotalRanking.mockRejectedValue(new Error("ranking failed"));

      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(200);
      expect(mocks.saveOnliveLog).toHaveBeenCalled();
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "総合ランキングの取得に失敗しました",
        expect.any(Object)
      );
    });

    it("saveOnliveLog が失敗した場合は 500 を返す", async () => {
      mocks.saveOnliveLog.mockRejectedValue(new Error("DB write error"));

      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Internal Server Error");
    });

    it("capturedAt と updatedAt が JST 文字列で返る", async () => {
      mocks.toJstWallTimeIsoString.mockReturnValue("2026-06-27T21:00:00.000+09:00");

      const response = await POST(makeRequest(validBody));
      const body = await response.json();

      expect(body.log.capturedAt).toBe("2026-06-27T21:00:00.000+09:00");
      expect(body.log.updatedAt).toBe("2026-06-27T21:00:00.000+09:00");
    });

    it("ログ保存成功後、最終コメント日時の更新処理を呼び出す", async () => {
      const extracted = [
        { userId: "u1", userName: "Alice", commentedAt: capturedAtDate },
      ];
      mocks.extractRoomUserCommentsFromLog.mockReturnValue(extracted);

      await POST(makeRequest(validBody));

      expect(mocks.extractRoomUserCommentsFromLog).toHaveBeenCalledWith([]);
      expect(mocks.upsertRoomUserLastComments).toHaveBeenCalledWith(
        "room-123",
        extracted
      );
    });

    it("最終コメント日時の更新に失敗してもログ保存レスポンスは成功する", async () => {
      mocks.upsertRoomUserLastComments.mockRejectedValue(new Error("update failed"));

      const response = await POST(makeRequest(validBody));

      expect(response.status).toBe(200);
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "最終コメント日時の更新に失敗しました",
        expect.any(Object)
      );
    });

    it("log にサーバーランキングスナップショットがマージされる", async () => {
      const ranking = [{ id: "rank-1", userId: "user-a" }];
      mocks.getRoomTotalRanking.mockResolvedValue(ranking);
      mocks.filterBlockedShowroomItems.mockReturnValue(ranking);

      await POST(makeRequest(validBody));

      const callArg = mocks.saveOnliveLog.mock.calls[0][0];
      expect(callArg.log).toMatchObject({
        server: expect.objectContaining({ version: 1 }),
        rankings: expect.objectContaining({ total: ranking }),
      });
    });
  });
});
