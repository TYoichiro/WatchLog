import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ActiveFanSummary,
  EventAndSupportSummary,
  RoomProfile,
  RoomStatus,
} from "@/lib/showroom";
import DashboardPage from "./page";

const { routerReplace } = vi.hoisted(() => ({
  routerReplace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
  }),
}));

vi.mock("@/components/navigation/app-sidebar", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

const fetchMock = vi.fn<typeof fetch>();

type RegisteredRoom = {
  imageUrl: string | null;
  roomId: string;
  roomName: string | null;
  roomUrl: string;
};

type DashboardFetchScenario = {
  activeFan?: ActiveFanSummary | null;
  eventAndSupport?: EventAndSupportSummary | null;
  noticesOk?: boolean;
  profile?: RoomProfile;
  profileOk?: boolean;
  registeredRoom?: RegisteredRoom | null;
  roomStatus?: RoomStatus;
};

const registeredRoom: RegisteredRoom = {
  imageUrl: "https://static.showroom-live.com/room.jpg",
  roomId: "12345",
  roomName: "Alpha Room",
  roomUrl: "alpha-room",
};

const profile: RoomProfile = {
  currentLiveStartedAt: null,
  followerNum: "1,234",
  genreName: "Music",
  isOfficial: true,
  isOnlive: false,
  leagueLabel: "A",
  nextShowRankSubdivided: "A2",
  premiumRoomType: 0,
  roomId: 12345,
  roomImageUrl: "https://static.showroom-live.com/room.jpg",
  roomLevel: "7",
  roomName: "Alpha Room",
  roomUrlKey: "alpha-room",
  showRankSubdivided: "A1",
  showRankTimeCharge: "1000pt",
  viewNum: 5678,
};

const activeFan: ActiveFanSummary = {
  fanName: "Alpha Fans",
  totalUserCount: "42",
};

const eventAndSupport: EventAndSupportSummary = {
  event: {
    endAt: 1778338800,
    eventUrl: "https://example.com/events/alpha",
    id: 1,
    imageUrl: "https://static.showroom-live.com/event.jpg",
    name: "Spring Music Event",
    startAt: 1778252400,
  },
  ranking: {
    beforeRank: 3,
    gap: "3,000",
    point: "12,345",
    rank: 2,
  },
  support: null,
};

const roomStatus: RoomStatus = {
  broadcastHost: null,
  broadcastKey: null,
  broadcastPort: null,
  isLive: false,
  liveStatus: null,
  roomId: 12345,
  roomUrlKey: "alpha-room",
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
    ...init,
  });
}

function getFetchUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function setupFetchScenario({
  activeFan: activeFanData = activeFan,
  eventAndSupport: eventAndSupportData = eventAndSupport,
  noticesOk = true,
  profile: profileData = profile,
  profileOk = true,
  registeredRoom: registeredRoomData = registeredRoom,
  roomStatus: roomStatusData = roomStatus,
}: DashboardFetchScenario = {}) {
  fetchMock.mockImplementation(async (input) => {
    const url = getFetchUrl(input);

    if (url === "/api/dashboard") {
      if (!registeredRoomData) {
        return jsonResponse({ status: "no_room" });
      }

      const resolvedProfile = profileOk ? profileData : null;
      const isLive =
        resolvedProfile?.isOnlive === true || roomStatusData.isLive === true;

      return jsonResponse({
        status: isLive ? "is_live" : "ok",
        registeredRoom: {
          roomId: registeredRoomData.roomId,
          roomUrl: registeredRoomData.roomUrl,
        },
        profile: resolvedProfile,
        activeFan: activeFanData,
        eventAndSupport: eventAndSupportData,
        notices: noticesOk
          ? [
              {
                body: "Dashboard maintenance is scheduled.",
                date: "2026/05/09 21:00",
                id: 1,
                linkUrl: null,
                title: "Dashboard notice",
              },
            ]
          : [],
        noticesHasError: !noticesOk,
        roomStatus: roomStatusData,
      });
    }

    throw new Error(`Unhandled fetch URL: ${url}`);
  });
}

function fetchCallsFor(path: string) {
  return fetchMock.mock.calls.filter(([input]) => getFetchUrl(input).startsWith(path));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  routerReplace.mockReset();
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

describe("DashboardPage", () => {
  it("redirects to search when no room is registered", async () => {
    setupFetchScenario({ registeredRoom: null });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/search");
    });
    expect(screen.queryByTestId("app-shell")).toBeNull();
  });

  it("redirects to onlive when the registered room is already live", async () => {
    setupFetchScenario({
      profile: {
        ...profile,
        isOnlive: true,
      },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/onlive");
    });
    expect(screen.queryByText("Alpha Room")).toBeNull();
  });

  it("renders profile stats, event information, and dashboard notices", async () => {
    setupFetchScenario();

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Alpha Room" })).toBeDefined();
    expect(screen.getByTestId("app-shell")).toBeDefined();
    expect(screen.getByText("公式枠ルーム")).toBeDefined();

    expect(screen.getByText("フォロワー数")).toBeDefined();
    expect(screen.getByText("1,234 人")).toBeDefined();
    expect(screen.getByText("Alpha Fans")).toBeDefined();
    expect(screen.getByText("42 人")).toBeDefined();
    expect(screen.getByText("ルームレベル")).toBeDefined();
    expect(screen.getByText("7 Lv")).toBeDefined();
    expect(screen.getByText("SHOWランク")).toBeDefined();
    expect(screen.getByText("A1（1000pt/1時間）")).toBeDefined();
    expect(screen.getByText("ジャンル")).toBeDefined();
    expect(screen.getByText("Music")).toBeDefined();

    expect(screen.getByText("開催中のイベント")).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: "Spring Music Event" })).toBeDefined();
    expect(screen.getByText("2 位")).toBeDefined();
    expect(screen.getByText("12,345 pt（次順位まで 3,000 pt）")).toBeDefined();

    expect(await screen.findByRole("heading", { level: 3, name: "1. Dashboard notice" })).toBeDefined();
    expect(screen.getByText("Dashboard maintenance is scheduled.")).toBeDefined();
  });

  it("continues rendering the dashboard when supplemental endpoints fail", async () => {
    setupFetchScenario({
      activeFan: null,
      eventAndSupport: null,
    });

    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Alpha Room" })).toBeDefined();
    expect(screen.getByText("アクティブファン")).toBeDefined();
    expect(screen.getAllByText("取得できませんでした").length).toBeGreaterThan(0);
    expect(screen.queryByText("開催中のイベント")).toBeNull();
  });

  it("fetches dashboard data with no-store cache", async () => {
    setupFetchScenario();

    render(<DashboardPage />);

    await screen.findByRole("heading", { level: 1, name: "Alpha Room" });

    const bffCalls = fetchCallsFor("/api/dashboard");
    expect(bffCalls.length).toBeGreaterThan(0);
    expect(bffCalls[0][1]).toEqual(expect.objectContaining({ cache: "no-store" }));
  });

  it("renders the dashboard shell when the profile endpoint fails", async () => {
    setupFetchScenario({ profileOk: false });

    render(<DashboardPage />);

    expect(await screen.findByTestId("app-shell")).toBeDefined();
    expect(screen.getByText("ルーム情報を取得できませんでした")).toBeDefined();
    expect(screen.getAllByText("取得できませんでした").length).toBeGreaterThan(0);
  });

  it("redirects to /onlive when the BFF reports the room is live", async () => {
    setupFetchScenario({ roomStatus: { ...roomStatus, isLive: true } });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/onlive");
    });
    expect(screen.queryByRole("heading", { level: 1, name: "Alpha Room" })).toBeNull();
  });
});
