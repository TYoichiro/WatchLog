import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Page from "./page";
import type {
  RoomComment,
  RoomGiftDefinition,
  RoomGiftLog,
  RoomLiveInfo,
  RoomLiveRankingUser,
  RoomProfile,
  RoomTotalRankingUser,
} from "@/lib/showroom";

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
  }),
}));

vi.mock("@/components/navigation/app-sidebar", () => ({
  AppShell: ({
    activeKey,
    headerClassName,
    showMenu,
    children,
  }: {
    activeKey: string;
    headerClassName?: string;
    showMenu?: boolean;
    children: ReactNode;
  }) => (
    <main
      data-active-key={activeKey}
      data-header-class-name={headerClassName}
      data-show-menu={String(showMenu)}
      data-testid="app-shell"
    >
      {children}
    </main>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

type FetchScenario = {
  registeredRoom?: { roomId: unknown } | null;
  liveInfo?: RoomLiveInfo;
  profile?: RoomProfile;
  comments?: RoomComment[];
  giftDefinitions?: RoomGiftDefinition[];
  gifts?: RoomGiftLog[];
  liveRanking?: RoomLiveRankingUser[];
  totalRanking?: RoomTotalRankingUser[];
  telop?: string | null;
  blocks?: unknown[];
};

const baseProfile: RoomProfile = {
  roomId: 123,
  roomUrlKey: "alpha-room",
  roomName: "Alpha Room",
  roomImageUrl: "https://example.com/room.jpg",
  isOnlive: true,
  premiumRoomType: 0,
  followerNum: "1,234",
  viewNum: 567,
  genreName: "Music",
  isOfficial: true,
  roomLevel: "7",
  leagueLabel: "A",
  showRankSubdivided: "A1",
  showRankTimeCharge: null,
  nextShowRankSubdivided: "A2",
  currentLiveStartedAt: null,
};

const baseLiveInfo: RoomLiveInfo = {
  bcsvrKey: "bcsvr-key",
  liveId: "live-123",
  liveStatus: 2,
};

const baseComments: RoomComment[] = [
  {
    id: "comment-1",
    avatarId: 1,
    avatarUrl: "https://example.com/avatar.png",
    classLevel: 5,
    createdAt: 1_760_000_000,
    name: "Comment User",
    text: "Hello live",
    userId: "10",
  },
];

const baseGiftDefinitions: RoomGiftDefinition[] = [
  {
    giftId: 1,
    giftImageUrl: "https://example.com/free.png",
    giftName: "Free Star",
    isFree: true,
    point: 1,
  },
  {
    giftId: 2,
    giftImageUrl: "https://example.com/paid.png",
    giftName: "Paid Heart",
    isFree: false,
    point: 100,
  },
];

const baseGifts: RoomGiftLog[] = [
  {
    id: "gift-1",
    avatarId: 1,
    avatarUrl: "https://example.com/avatar-free.png",
    count: 2,
    createdAt: 1_760_000_001,
    giftId: 1,
    giftImageUrl: "https://example.com/free.png",
    giftName: "Free Star",
    isFree: true,
    point: 1,
    totalPoint: 2,
    userId: 11,
    userImageUrl: "https://example.com/free-user.png",
    userName: "Free Giver",
    userVisitStatus: "初見",
  },
  {
    id: "gift-2",
    avatarId: 2,
    avatarUrl: "https://example.com/avatar-paid.png",
    count: 1,
    createdAt: 1_760_000_002,
    giftId: 2,
    giftImageUrl: "https://example.com/paid.png",
    giftName: "Paid Heart",
    isFree: false,
    point: 100,
    totalPoint: 100,
    userId: 12,
    userImageUrl: "https://example.com/paid-user.png",
    userName: "Paid Giver",
    userVisitStatus: "常連",
  },
];

const baseLiveRanking: RoomLiveRankingUser[] = [
  {
    id: "live-rank-1",
    avatarId: 1,
    avatarUrl: "https://example.com/live-rank-avatar.png",
    badge: "gold",
    badgeType: 1,
    orderNo: 1,
    rank: 1,
    userId: 13,
    userImageUrl: "https://example.com/live-rank-user.png",
    userName: "Live Ranker",
    userVisitStatus: "常連",
  },
];

const baseTotalRanking: RoomTotalRankingUser[] = [
  {
    id: "total-rank-1",
    avatarId: 1,
    avatarUrl: "https://example.com/total-rank-avatar.png",
    order: 1,
    point: 250,
    rank: 1,
    userId: 14,
    userName: "Total Ranker",
    userVisitStatus: "常連",
    visitCount: 3,
  },
];

const getFetchUrl = (input: RequestInfo | URL) =>
  typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const mockFetch = (scenario: FetchScenario = {}) => {
  const {
    registeredRoom = { roomId: "123" },
    liveInfo = baseLiveInfo,
    profile = baseProfile,
    comments = baseComments,
    giftDefinitions = baseGiftDefinitions,
    gifts = baseGifts,
    liveRanking = baseLiveRanking,
    totalRanking = baseTotalRanking,
    telop = "Today telop",
    blocks = [],
  } = scenario;

  const parsedRoomId = registeredRoom ? Number(registeredRoom.roomId) : NaN;
  const isValidRoom =
    registeredRoom !== null &&
    Number.isInteger(parsedRoomId) &&
    parsedRoomId > 0;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getFetchUrl(input);
    const method = init?.method ?? "GET";

    if (url === "/api/onlive/init") {
      if (!isValidRoom) {
        return jsonResponse({ status: "no_room" });
      }

      return jsonResponse({
        status: "ok",
        roomId: parsedRoomId,
        liveInfo,
        giftDefinitions,
        comments,
        gifts,
        telop,
      });
    }

    if (url === "/api/onlive/poll") {
      return jsonResponse({
        profile,
        profileHasError: false,
        liveRanking,
        liveRankingHasError: false,
        totalRanking,
        totalRankingHasError: false,
      });
    }

    if (url.startsWith("/api/room/user-profile")) {
      return jsonResponse({
        profile: {
          activeFanLevel: null,
          avatarId: null,
          avatarUrl: null,
          classLevel: null,
          description: "",
          fanLevel: null,
          imageUrl: null,
          isSmsAuthenticated: false,
          name: "Comment User Profile",
          snsList: [],
          roomProfile: null,
        },
      });
    }

    if (url === "/api/blocks" && method === "POST") {
      return jsonResponse({
        block: {
          id: "new-block-1",
          blockedUserId: "10",
          blockedUserName: "Comment User",
          createdAt: "2026-05-09T12:00:00.000Z",
          updatedAt: "2026-05-09T12:00:00.000Z",
        },
      });
    }

    if (url === "/api/blocks") {
      return jsonResponse({ blocks });
    }

    return jsonResponse({ message: "not found" }, { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

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

beforeEach(() => {
  routerReplace.mockClear();
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("Onlive page", () => {
  it("登録ルームがない場合は検索画面へ遷移する", async () => {
    mockFetch({ registeredRoom: null });

    render(<Page />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/search");
    });
    expect(screen.queryByTestId("app-shell")).toBeNull();
  });

  it("登録ルームIDが不正な場合は検索画面へ遷移する", async () => {
    mockFetch({ registeredRoom: { roomId: "invalid" } });

    render(<Page />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/search");
    });
  });

  it("登録ルームのライブ情報とログを表示する", async () => {
    const fetchMock = mockFetch();

    render(<Page />);

    const appShell = await screen.findByTestId("app-shell");
    expect(appShell.getAttribute("data-active-key")).toBe("dashboard");
    expect(appShell.getAttribute("data-header-class-name")).toBe("h-8");
    expect(appShell.getAttribute("data-show-menu")).toBe("false");

    expect(await screen.findByText("Hello live")).not.toBeNull();
    expect(screen.getByText("\u7372\u5f97\u30dd\u30a4\u30f3\u30c8")).not.toBeNull();
    expect(screen.getByText("\u30d5\u30a9\u30ed\u30ef\u30fc\u6570")).not.toBeNull();
    expect(screen.getByText("\u76db\u308a\u4e0a\u304c\u308a")).not.toBeNull();
    expect(screen.getByText("\u914d\u4fe1\u958b\u59cb\u6642\u9593")).not.toBeNull();
    expect(screen.getByText("Today telop")).not.toBeNull();
    expect(screen.getByText("Free Star")).not.toBeNull();
    expect(screen.getByText("Paid Heart")).not.toBeNull();
    expect(screen.getByText("Live Ranker")).not.toBeNull();
    expect(screen.getByText("Total Ranker")).not.toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onlive/init",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onlive/poll",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("配信中ではない場合はダイアログを表示し、確認でダッシュボードへ戻る", async () => {
    mockFetch({
      liveInfo: {
        bcsvrKey: null,
        liveId: null,
        liveStatus: 1,
      },
    });

    render(<Page />);

    expect(
      await screen.findByRole("heading", { name: "\u914d\u4fe1\u4e2d\u3067\u306f\u3042\u308a\u307e\u305b\u3093" }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(routerReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("WebSocket接続後にSUBメッセージを送信する", async () => {
    mockFetch();

    render(<Page />);

    await screen.findByText("Hello live");

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    expect(ws.url).toBe("wss://online.showroom-live.com/");

    ws.readyState = MockWebSocket.OPEN;
    ws.emit("open", {});

    expect(ws.sent).toContain("SUB\tbcsvr-key");
  });

  it("ライブ中にユーザーをブロックできる", async () => {
    const fetchMock = mockFetch();

    render(<Page />);

    await screen.findByText("Hello live");

    await waitFor(() => {
      expect(screen.queryByTitle("Open Comment User profile")).not.toBeNull();
    });

    fireEvent.click(screen.getByTitle("Open Comment User profile"));

    expect(await screen.findByRole("dialog")).toBeDefined();

    const blockButton = await screen.findByRole("button", {
      name: "このユーザーをブロック",
    });
    fireEvent.click(blockButton);

    await waitFor(() => {
      const blockPostCalls = fetchMock.mock.calls.filter(
        ([input, init]) =>
          getFetchUrl(input) === "/api/blocks" && init?.method === "POST",
      );
      expect(blockPostCalls.length).toBeGreaterThan(0);
    });
  });

  it("ブロック済みユーザーのコメントは表示されない", async () => {
    mockFetch({
      blocks: [
        {
          id: "block-1",
          blockedUserId: "10",
          blockedUserName: "Comment User",
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z",
        },
      ],
    });

    render(<Page />);

    await screen.findByTestId("app-shell");

    await waitFor(() => {
      expect(screen.queryByText("Hello live")).toBeNull();
    });
  });

  it("ポーリングが失敗してもページはクラッシュせず表示される", async () => {
    const fetchMock = mockFetch();
    const baseImpl = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (getFetchUrl(input) === "/api/onlive/poll") {
        return jsonResponse({ message: "error" }, { status: 500 });
      }
      return baseImpl(input, init);
    });

    render(<Page />);

    expect(await screen.findByTestId("app-shell")).toBeDefined();
    expect(await screen.findByText("Hello live")).toBeDefined();
  });
});
