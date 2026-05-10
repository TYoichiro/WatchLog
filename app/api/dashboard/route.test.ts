import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getDashboardNotices: vi.fn(),
  getRoomActiveFan: vi.fn(),
  getRoomEventAndSupport: vi.fn(),
  getRoomProfile: vi.fn(),
  getRoomStatus: vi.fn(),
  getUserRegisteredRoom: vi.fn(),
  hasTopAdminRole: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/authz", () => ({
  hasTopAdminRole: mocks.hasTopAdminRole,
}));

vi.mock("@/lib/dashboard-notices", () => ({
  getDashboardNotices: mocks.getDashboardNotices,
}));

vi.mock("@/lib/showroom", () => ({
  getRoomActiveFan: mocks.getRoomActiveFan,
  getRoomEventAndSupport: mocks.getRoomEventAndSupport,
  getRoomProfile: mocks.getRoomProfile,
  getRoomStatus: mocks.getRoomStatus,
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
  isOnlive: false,
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

const eventAndSupport = {
  event: {
    endAt: 1_768_338_000,
    eventUrl: "https://example.com/events/1",
    id: 1,
    imageUrl: "https://example.com/event.jpg",
    name: "Spring Event",
    startAt: 1_768_251_600,
  },
  ranking: {
    beforeRank: 3,
    gap: "300",
    point: "1,200",
    rank: 2,
  },
  support: null,
};

const roomStatus = {
  broadcastHost: null,
  broadcastKey: null,
  broadcastPort: null,
  isLive: false,
  liveStatus: null,
  roomId: 123,
  roomUrlKey: "alpha-room",
};

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasTopAdminRole.mockResolvedValue(false);
});

describe("GET /api/dashboard", () => {
  it("returns 401 when the user is not authenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await expectJson(response)).toEqual({ error: "Unauthorized" });
    expect(mocks.getUserRegisteredRoom).not.toHaveBeenCalled();
  });

  it("returns no_room when the authenticated user has no registered room", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await expectJson(response)).toEqual({ status: "no_room" });
    expect(mocks.getUserRegisteredRoom).toHaveBeenCalledWith("user-1");
  });

  it("returns aggregated dashboard data and marks live rooms", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
    mocks.getRoomProfile.mockResolvedValue(profile);
    mocks.getRoomActiveFan.mockResolvedValue({
      fanName: "Alpha Fans",
      totalUserCount: "42",
    });
    mocks.getRoomEventAndSupport.mockResolvedValue(eventAndSupport);
    mocks.getDashboardNotices.mockResolvedValue([
      {
        body: "Maintenance window",
        date: "2026/05/09 21:00",
        id: 10,
        linkUrl: null,
        title: "Notice",
      },
    ]);
    mocks.getRoomStatus.mockResolvedValue({ ...roomStatus, isLive: true });

    const response = await GET();
    const data = await expectJson(response);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: "is_live",
      isAdmin: false,
      registeredRoom: {
        roomId: "123",
        roomUrl: "alpha-room",
      },
      profile,
      eventAndSupport,
      noticesHasError: false,
      roomStatus: {
        isLive: true,
      },
    });
    expect(mocks.getRoomProfile).toHaveBeenCalledWith("123");
    expect(mocks.getRoomActiveFan).toHaveBeenCalledWith("123");
    expect(mocks.getRoomEventAndSupport).toHaveBeenCalledWith("123");
    expect(mocks.getRoomStatus).toHaveBeenCalledWith("alpha-room");
    expect(mocks.hasTopAdminRole).toHaveBeenCalledWith("user-1");
  });

  it("marks top admins in the dashboard payload", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.hasTopAdminRole.mockResolvedValue(true);
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
    mocks.getRoomProfile.mockResolvedValue(profile);
    mocks.getRoomActiveFan.mockResolvedValue(null);
    mocks.getRoomEventAndSupport.mockResolvedValue(null);
    mocks.getDashboardNotices.mockResolvedValue([]);
    mocks.getRoomStatus.mockResolvedValue(roomStatus);

    const response = await GET();
    const data = await expectJson(response);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: "ok",
      isAdmin: true,
    });
    expect(mocks.hasTopAdminRole).toHaveBeenCalledWith("admin-1");
  });

  it("keeps the response usable when supplemental sources fail", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);
    mocks.getRoomProfile.mockResolvedValue({ ...profile, isOnlive: false });
    mocks.getRoomActiveFan.mockRejectedValue(new Error("active fan failed"));
    mocks.getRoomEventAndSupport.mockRejectedValue(new Error("event failed"));
    mocks.getDashboardNotices.mockRejectedValue(new Error("notices failed"));
    mocks.getRoomStatus.mockRejectedValue(new Error("status failed"));

    const response = await GET();
    const data = await expectJson(response);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: "ok",
      isAdmin: false,
      activeFan: null,
      eventAndSupport: null,
      notices: [],
      noticesHasError: true,
      roomStatus: null,
    });
  });
});
