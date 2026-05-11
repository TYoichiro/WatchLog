import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getRoomCommentLog: vi.fn(),
  getRoomGiftDefinitions: vi.fn(),
  getRoomGiftLog: vi.fn(),
  getRoomLiveInfo: vi.fn(),
  getRoomTelop: vi.fn(),
  getUserRegisteredRoom: vi.fn(),
  hasPremiumRole: vi.fn(),
  listBlockedShowroomUserIds: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/authz", () => ({
  hasPremiumRole: mocks.hasPremiumRole,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
  },
}));

vi.mock("@/lib/showroom", () => ({
  getRoomCommentLog: mocks.getRoomCommentLog,
  getRoomGiftDefinitions: mocks.getRoomGiftDefinitions,
  getRoomGiftLog: mocks.getRoomGiftLog,
  getRoomLiveInfo: mocks.getRoomLiveInfo,
  getRoomTelop: mocks.getRoomTelop,
}));

vi.mock("@/lib/user-blocks", () => ({
  listBlockedShowroomUserIds: mocks.listBlockedShowroomUserIds,
}));

vi.mock("@/lib/user-registered-room", () => ({
  getUserRegisteredRoom: mocks.getUserRegisteredRoom,
}));

const registeredRoom = {
  imageUrl: null,
  roomId: "123",
  roomName: "Alpha Room",
  roomUrl: "alpha-room",
};

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasPremiumRole.mockResolvedValue(false);
});

describe("GET /api/onlive/init", () => {
  it("returns no_room when the user has no valid registered room", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue({
      ...registeredRoom,
      roomId: "not-a-number",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await expectJson(response)).toEqual({ status: "no_room" });
    expect(mocks.listBlockedShowroomUserIds).not.toHaveBeenCalled();
    expect(mocks.getRoomLiveInfo).not.toHaveBeenCalled();
  });

  it("returns initial live data and filters blocked users", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
    mocks.hasPremiumRole.mockResolvedValue(true);
    mocks.listBlockedShowroomUserIds.mockResolvedValue(["blocked-user"]);
    mocks.getRoomLiveInfo.mockResolvedValue({
      bcsvrKey: "bcsvr-key",
      liveId: "live-123",
      liveStatus: 2,
    });
    mocks.getRoomGiftDefinitions.mockResolvedValue([
      {
        giftId: 1,
        giftImageUrl: "https://example.com/gift.png",
        giftName: "Star",
        isFree: true,
        point: 1,
      },
    ]);
    mocks.getRoomCommentLog.mockResolvedValue([
      {
        id: "comment-allowed",
        avatarId: null,
        avatarUrl: null,
        classLevel: null,
        createdAt: 1,
        name: "Allowed User",
        text: "hello",
        userId: "allowed-user",
      },
      {
        id: "comment-blocked",
        avatarId: null,
        avatarUrl: null,
        classLevel: null,
        createdAt: 2,
        name: "Blocked User",
        text: "hidden",
        userId: "blocked-user",
      },
    ]);
    mocks.getRoomGiftLog.mockResolvedValue([
      {
        id: "gift-allowed",
        avatarId: null,
        avatarUrl: null,
        count: 1,
        createdAt: 3,
        giftId: 1,
        giftImageUrl: null,
        giftName: "Star",
        isFree: true,
        point: 1,
        totalPoint: 1,
        userId: "allowed-user",
        userImageUrl: null,
        userName: "Allowed User",
        userVisitStatus: null,
      },
      {
        id: "gift-blocked",
        avatarId: null,
        avatarUrl: null,
        count: 1,
        createdAt: 4,
        giftId: 1,
        giftImageUrl: null,
        giftName: "Star",
        isFree: true,
        point: 1,
        totalPoint: 1,
        userId: "blocked-user",
        userImageUrl: null,
        userName: "Blocked User",
        userVisitStatus: null,
      },
    ]);
    mocks.getRoomTelop.mockResolvedValue("Today telop");

    const response = await GET();
    const data = await expectJson(response);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: "ok",
      roomId: 123,
      isPremium: true,
      liveInfo: {
        bcsvrKey: "bcsvr-key",
        liveId: "live-123",
        liveStatus: 2,
      },
      telop: "Today telop",
    });
    expect(data.comments).toEqual([
      expect.objectContaining({ id: "comment-allowed" }),
    ]);
    expect(data.gifts).toEqual([
      expect.objectContaining({ id: "gift-allowed" }),
    ]);
    expect(mocks.listBlockedShowroomUserIds).toHaveBeenCalledWith("user-1");
    expect(mocks.getRoomLiveInfo).toHaveBeenCalledWith("123");
    expect(mocks.getRoomGiftDefinitions).toHaveBeenCalledWith("123");
    expect(mocks.getRoomCommentLog).toHaveBeenCalledWith("123");
    expect(mocks.getRoomGiftLog).toHaveBeenCalledWith("123");
    expect(mocks.getRoomTelop).toHaveBeenCalledWith("123");
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "Onlive screen: room is live",
      {
        roomId: "123",
        roomUrl: "alpha-room",
        userId: "user-1",
      },
    );
  });

  it("uses safe defaults when optional live sources fail", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
    mocks.listBlockedShowroomUserIds.mockResolvedValue([]);
    mocks.getRoomLiveInfo.mockRejectedValue(new Error("live info failed"));
    mocks.getRoomGiftDefinitions.mockRejectedValue(new Error("definitions failed"));
    mocks.getRoomCommentLog.mockRejectedValue(new Error("comments failed"));
    mocks.getRoomGiftLog.mockRejectedValue(new Error("gifts failed"));
    mocks.getRoomTelop.mockRejectedValue(new Error("telop failed"));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await expectJson(response)).toEqual({
      status: "ok",
      roomId: 123,
      isPremium: false,
      liveInfo: null,
      giftDefinitions: [],
      comments: [],
      gifts: [],
      telop: null,
    });
    expect(mocks.loggerInfo).not.toHaveBeenCalled();
  });
});
