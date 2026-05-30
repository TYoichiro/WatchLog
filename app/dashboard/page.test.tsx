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

const { routerReplace, mockRouter } = vi.hoisted(() => {
  const routerReplace = vi.fn();
  return { routerReplace, mockRouter: { replace: routerReplace } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
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
  isAdmin?: boolean;
  isPremium?: boolean;
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
  isAdmin = false,
  isPremium = false,
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
        isAdmin,
        isPremium,
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

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly sent: string[] = [];
  readonly url: string;
  readyState = MockWebSocket.CONNECTING;

  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", {});
  }

  emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  routerReplace.mockReset();
});

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("WebSocket", MockWebSocket);
});

describe("DashboardPage", () => {
  it("redirects to search when no room is registered", async () => {
    setupFetchScenario({ registeredRoom: null });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/search");
    });
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

  it("starts a WebSocket watcher for non-admin users when a broadcast key is available", async () => {
    setupFetchScenario({
      roomStatus: {
        ...roomStatus,
        broadcastKey: "bcsvr-key",
      },
    });

    render(<DashboardPage />);

    await screen.findByRole("heading", { level: 1, name: "Alpha Room" });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });
    expect(MockWebSocket.instances[0].url).toBe("wss://online.showroom-live.com/");
  });

  it("does not start a WebSocket watcher for admin users", async () => {
    setupFetchScenario({
      isAdmin: true,
      roomStatus: {
        ...roomStatus,
        broadcastKey: "bcsvr-key",
      },
    });

    render(<DashboardPage />);

    await screen.findByRole("heading", { level: 1, name: "Alpha Room" });

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("renders the dashboard shell when the profile endpoint fails", async () => {
    setupFetchScenario({ profileOk: false });

    render(<DashboardPage />);

    expect(await screen.findByText("ルーム情報を取得できませんでした")).toBeDefined();
    expect(screen.getByTestId("app-shell")).toBeDefined();
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

  it("redirects to /search when the dashboard fetch throws a network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/search");
    });
  });

  it("sends a SUB message to WebSocket after the connection opens", async () => {
    setupFetchScenario({
      roomStatus: { ...roomStatus, broadcastKey: "bcsvr-key" },
    });

    render(<DashboardPage />);

    await screen.findByRole("heading", { level: 1, name: "Alpha Room" });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const ws = MockWebSocket.instances[0];
    ws.readyState = MockWebSocket.OPEN;
    ws.emit("open", {});

    expect(ws.sent).toContain("SUB\tbcsvr-key");
  });

  it("redirects to /onlive when WebSocket receives a live-started message", async () => {
    setupFetchScenario({
      roomStatus: { ...roomStatus, broadcastKey: "bcsvr-key" },
    });

    render(<DashboardPage />);

    await screen.findByRole("heading", { level: 1, name: "Alpha Room" });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const ws = MockWebSocket.instances[0];
    ws.readyState = MockWebSocket.OPEN;
    ws.emit("open", {});
    ws.emit("message", { data: `MSG\tbcsvr-key\t{"t":104}` });

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/onlive");
    });
  });

  it("shows skeleton loading state while fetching", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    render(<DashboardPage />);

    expect(screen.getByText("読み込み中")).toBeDefined();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("shows notice error UI when the notices fetch fails", async () => {
    setupFetchScenario({ noticesOk: false });

    render(<DashboardPage />);

    await screen.findByRole("heading", { level: 1, name: "Alpha Room" });
    expect(screen.getByText("取得失敗")).toBeDefined();
    expect(screen.getByText("お知らせを取得できませんでした")).toBeDefined();
  });

  it("shows フリー枠ルーム badge for non-official rooms", async () => {
    setupFetchScenario({ profile: { ...profile, isOfficial: false } });

    render(<DashboardPage />);

    await screen.findByRole("heading", { level: 1, name: "Alpha Room" });
    expect(screen.getByText("フリー枠ルーム")).toBeDefined();
    expect(screen.queryByText("公式枠ルーム")).toBeNull();
  });

  it("shows empty notices message when no public notices are available", async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({
        activeFan,
        eventAndSupport,
        isAdmin: false,
        isPremium: false,
        notices: [],
        noticesHasError: false,
        profile,
        registeredRoom: { roomId: registeredRoom.roomId, roomUrl: registeredRoom.roomUrl },
        roomStatus,
        status: "ok",
      })
    );

    render(<DashboardPage />);

    await screen.findByRole("heading", { level: 1, name: "Alpha Room" });
    expect(screen.getByText("公開中のお知らせはありません。")).toBeDefined();
  });

  it("does not start a WebSocket watcher for non-admin users without a broadcast key", async () => {
    setupFetchScenario(); // default roomStatus has broadcastKey: null

    render(<DashboardPage />);

    await screen.findByRole("heading", { level: 1, name: "Alpha Room" });

    expect(MockWebSocket.instances).toHaveLength(0);
  });
});
