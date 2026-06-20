import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getRoomLiveRanking: vi.fn(),
  getRoomProfile: vi.fn(),
  getRoomTotalRanking: vi.fn(),
  getUserRegisteredRoom: vi.fn(),
  getCachedBlockedShowroomUserIds: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/showroom", () => ({
  getRoomLiveRanking: mocks.getRoomLiveRanking,
  getRoomProfile: mocks.getRoomProfile,
  getRoomTotalRanking: mocks.getRoomTotalRanking,
}));

vi.mock("@/lib/user-blocks", () => ({
  getCachedBlockedShowroomUserIds: mocks.getCachedBlockedShowroomUserIds,
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

const profile = {
  currentLiveStartedAt: null,
  followerNum: "1,234",
  genreName: "Music",
  isOfficial: true,
  isOnlive: true,
  leagueLabel: "A",
  nextShowRankSubdivided: "A2",
  premiumRoomType: 0,
  roomId: 123,
  roomImageUrl: "https://example.com/room.jpg",
  roomLevel: "7",
  roomName: "Alpha Room",
  roomUrlKey: "alpha-room",
  showRankSubdivided: "A1",
  showRankTimeCharge: "670",
  viewNum: 5678,
};

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/onlive/poll", () => {
  it("未認証の場合は 404 を返す", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/onlive/poll"));

    expect(response.status).toBe(404);
    expect(await expectJson(response)).toEqual({ error: "No registered room" });
    expect(mocks.getUserRegisteredRoom).not.toHaveBeenCalled();
    expect(mocks.getRoomProfile).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no registered room", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/onlive/poll"));

    expect(response.status).toBe(404);
    expect(await expectJson(response)).toEqual({ error: "No registered room" });
    expect(mocks.getRoomProfile).not.toHaveBeenCalled();
  });

  it("returns poll data and filters blocked ranking users", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
    mocks.getCachedBlockedShowroomUserIds.mockResolvedValue(["blocked-user"]);
    mocks.getRoomProfile.mockResolvedValue(profile);
    mocks.getRoomLiveRanking.mockResolvedValue([
      {
        id: "live-allowed",
        avatarId: null,
        avatarUrl: null,
        badge: null,
        badgeType: null,
        orderNo: 1,
        rank: 1,
        userId: "allowed-user",
        userImageUrl: null,
        userName: "Allowed User",
        userVisitStatus: null,
      },
      {
        id: "live-blocked",
        avatarId: null,
        avatarUrl: null,
        badge: null,
        badgeType: null,
        orderNo: 2,
        rank: 2,
        userId: "blocked-user",
        userImageUrl: null,
        userName: "Blocked User",
        userVisitStatus: null,
      },
    ]);
    mocks.getRoomTotalRanking.mockResolvedValue([
      {
        id: "total-allowed",
        avatarId: null,
        avatarUrl: null,
        order: 1,
        point: 100,
        rank: 1,
        userId: "allowed-user",
        userName: "Allowed User",
        userVisitStatus: null,
        visitCount: 3,
      },
      {
        id: "total-blocked",
        avatarId: null,
        avatarUrl: null,
        order: 2,
        point: 50,
        rank: 2,
        userId: "blocked-user",
        userName: "Blocked User",
        userVisitStatus: null,
        visitCount: 1,
      },
    ]);

    const response = await GET(new Request("http://localhost/api/onlive/poll"));
    const data = await expectJson(response);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      profile,
      profileHasError: false,
      liveRankingHasError: false,
      totalRankingHasError: false,
    });
    expect(data.liveRanking).toEqual([
      expect.objectContaining({ id: "live-allowed" }),
    ]);
    expect(data.totalRanking).toEqual([
      expect.objectContaining({ id: "total-allowed" }),
    ]);
    expect(mocks.getCachedBlockedShowroomUserIds).toHaveBeenCalledWith("user-1");
    expect(mocks.getRoomProfile).toHaveBeenCalledWith("123");
    expect(mocks.getRoomLiveRanking).toHaveBeenCalledWith("123");
    expect(mocks.getRoomTotalRanking).toHaveBeenCalledWith("123");
  });

  it("skip_ranking=1 のクエリがある場合ランキングをスキップして空配列とエラーフラグを返す", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
    mocks.getCachedBlockedShowroomUserIds.mockResolvedValue([]);
    mocks.getRoomProfile.mockResolvedValue(profile);

    const response = await GET(new Request("http://localhost/api/onlive/poll?skip_ranking=1"));
    const data = await expectJson(response);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      profile,
      profileHasError: false,
      liveRanking: [],
      liveRankingHasError: true,
      totalRanking: [],
      totalRankingHasError: true,
    });
    expect(mocks.getRoomLiveRanking).not.toHaveBeenCalled();
    expect(mocks.getRoomTotalRanking).not.toHaveBeenCalled();
  });

  it("全ソースが失敗した場合は全てデフォルト値で返す", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
    mocks.getCachedBlockedShowroomUserIds.mockResolvedValue([]);
    mocks.getRoomProfile.mockRejectedValue(new Error("profile failed"));
    mocks.getRoomLiveRanking.mockRejectedValue(new Error("live ranking failed"));
    mocks.getRoomTotalRanking.mockRejectedValue(new Error("total ranking failed"));

    const response = await GET(new Request("http://localhost/api/onlive/poll"));
    const data = await expectJson(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({
      profile: null,
      profileHasError: true,
      liveRanking: [],
      liveRankingHasError: true,
      totalRanking: [],
      totalRankingHasError: true,
    });
  });

  it("reports per-source errors and keeps successful data", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
    mocks.getCachedBlockedShowroomUserIds.mockResolvedValue([]);
    mocks.getRoomProfile.mockRejectedValue(new Error("profile failed"));
    mocks.getRoomLiveRanking.mockRejectedValue(new Error("live ranking failed"));
    mocks.getRoomTotalRanking.mockResolvedValue([
      {
        id: "total-allowed",
        avatarId: null,
        avatarUrl: null,
        order: 1,
        point: 100,
        rank: 1,
        userId: "allowed-user",
        userName: "Allowed User",
        userVisitStatus: null,
        visitCount: 3,
      },
    ]);

    const response = await GET(new Request("http://localhost/api/onlive/poll"));

    expect(response.status).toBe(200);
    expect(await expectJson(response)).toEqual({
      profile: null,
      profileHasError: true,
      liveRanking: [],
      liveRankingHasError: true,
      totalRanking: [
        {
          id: "total-allowed",
          avatarId: null,
          avatarUrl: null,
          order: 1,
          point: 100,
          rank: 1,
          userId: "allowed-user",
          userName: "Allowed User",
          userVisitStatus: null,
          visitCount: 3,
        },
      ],
      totalRankingHasError: false,
    });
  });
});
