import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LogDetailPage from "./page";
import type { OnliveLogDetail } from "@/lib/onlive-log";

const {
  authMock,
  blockUserMock,
  getAnyOnliveLogMock,
  getUserOnliveLogMock,
  hasTopAdminRoleMock,
  notFoundMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  blockUserMock: vi.fn(),
  getAnyOnliveLogMock: vi.fn(),
  getUserOnliveLogMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/authz", () => ({
  hasTopAdminRole: hasTopAdminRoleMock,
}));

vi.mock("@/lib/onlive-log", () => ({
  getAnyOnliveLog: getAnyOnliveLogMock,
  getUserOnliveLog: getUserOnliveLogMock,
}));

vi.mock("@/hooks/use-user-blocks", () => ({
  useUserBlocks: () => ({
    blockedUserIds: new Set<string>(),
    blockUser: blockUserMock,
    isLoading: false,
  }),
}));

vi.mock("@/components/navigation/app-sidebar", () => ({
  AppShell: ({
    activeKey,
    children,
  }: {
    activeKey?: string;
    children: ReactNode;
  }) => (
    <div data-active-key={activeKey} data-testid="app-shell">
      {children}
    </div>
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
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const session = {
  user: {
    id: "user-1",
  },
};

const archivedLog = {
  comments: [
    {
      id: "comment-1",
      avatarId: 1,
      avatarUrl: "https://example.com/comment-avatar.png",
      classLevel: 5,
      createdAt: 1_760_000_001,
      name: "Comment User",
      notice: false,
      noticeTone: null,
      telop: false,
      text: "Archived hello",
      userId: "10",
      userVisitStatus: 1,
    },
  ],
  gifts: [
    {
      id: "gift-1",
      avatarId: 1,
      avatarUrl: "https://example.com/free-avatar.png",
      count: 2,
      createdAt: 1_760_000_002,
      giftId: 1,
      giftImageUrl: "https://example.com/free.png",
      giftName: "Free Star",
      isFree: true,
      point: 1,
      totalPoint: 2,
      userId: "11",
      userImageUrl: "https://example.com/free-user.png",
      userName: "Free Giver",
      userVisitStatus: 2,
    },
    {
      id: "gift-2",
      avatarId: 2,
      avatarUrl: "https://example.com/paid-avatar.png",
      count: 1,
      createdAt: 1_760_000_003,
      giftId: 2,
      giftImageUrl: "https://example.com/paid.png",
      giftName: "Paid Heart",
      isFree: false,
      point: 100,
      totalPoint: 100,
      userId: "12",
      userImageUrl: "https://example.com/paid-user.png",
      userName: "Paid Giver",
      userVisitStatus: 3,
    },
  ],
  liveInfo: {
    endedAt: 1_760_003_600,
    liveId: "live-1",
    liveStatus: 2,
    startedAt: 1_760_000_000,
    telop: "Archived telop",
  },
  metrics: {
    giftTotals: {
      freePoints: 2,
      paidPoints: 100,
      totalPoints: 102,
    },
    initialFollowerNum: "1,000",
    latestAudienceNum: 567,
    latestFollowerNum: "1,234",
    previousAudienceNum: 500,
  },
  rankings: {
    live: [
      {
        id: "live-rank-1",
        avatarId: 1,
        avatarUrl: "https://example.com/live-rank-avatar.png",
        badge: 1,
        badgeType: 1,
        orderNo: 1,
        rank: 1,
        userId: "13",
        userImageUrl: "https://example.com/live-rank-user.png",
        userName: "Live Ranker",
        userVisitStatus: 4,
      },
    ],
    total: [
      {
        id: "total-rank-1",
        avatarId: 1,
        avatarUrl: "https://example.com/total-rank-avatar.png",
        order: 1,
        point: 250,
        rank: 1,
        userId: "14",
        userName: "Total Ranker",
        userVisitStatus: 5,
        visitCount: 3,
      },
    ],
  },
  roomId: 12345,
  roomProfile: {
    currentLiveStartedAt: 1_760_000_000,
    followerNum: "1,234",
    genreName: "Music",
    isOfficial: true,
    isOnlive: false,
    leagueLabel: "A",
    nextShowRankSubdivided: "A2",
    premiumRoomType: 0,
    roomId: 12345,
    roomImageUrl: "https://example.com/room.png",
    roomLevel: "7",
    roomName: "Alpha Room",
    roomUrlKey: "alpha-room",
    showRankSubdivided: "A1",
    showRankTimeCharge: null,
    viewNum: 567,
  },
};

const logDetail: OnliveLogDetail = {
  capturedAt: new Date(Date.UTC(2026, 4, 9, 12, 0, 0)),
  createdAt: new Date(Date.UTC(2026, 4, 9, 12, 1, 0)),
  id: "log-1",
  liveId: "live-1",
  liveStartedAt: 1_760_000_000,
  log: archivedLog,
  room: {
    imageUrl: "https://example.com/room.png",
    roomId: "12345",
    roomName: "Alpha Room",
    roomUrl: "alpha-room",
  },
  roomId: "12345",
  updatedAt: new Date(Date.UTC(2026, 4, 9, 12, 2, 0)),
};

async function renderResolvedLogDetailPage(logId = "log-1") {
  render(
    await LogDetailPage({
      params: Promise.resolve({ logId }),
    }),
  );
}

function setupAuthenticatedUser({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  authMock.mockResolvedValue(session);
  hasTopAdminRoleMock.mockResolvedValue(isAdmin);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  authMock.mockReset();
  blockUserMock.mockReset();
  getAnyOnliveLogMock.mockReset();
  getUserOnliveLogMock.mockReset();
  hasTopAdminRoleMock.mockReset();
  notFoundMock.mockClear();
  redirectMock.mockClear();
});

describe("LogDetailPage", () => {
  it("未ログインの場合はログイン画面へ遷移する", async () => {
    authMock.mockResolvedValue(null);

    await expect(
      LogDetailPage({ params: Promise.resolve({ logId: "log-1" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(hasTopAdminRoleMock).not.toHaveBeenCalled();
    expect(getUserOnliveLogMock).not.toHaveBeenCalled();
    expect(getAnyOnliveLogMock).not.toHaveBeenCalled();
  });

  it("管理者は任意のログ詳細を表示できる", async () => {
    setupAuthenticatedUser({ isAdmin: true });
    getAnyOnliveLogMock.mockResolvedValue(logDetail);

    await renderResolvedLogDetailPage();

    expect(screen.getByTestId("app-shell").getAttribute("data-active-key")).toBe(
      "logs",
    );
    expect(screen.getByText("Archived hello")).toBeDefined();
    expect(screen.getByText("Archived telop")).toBeDefined();
    expect(screen.getByText("Free Star")).toBeDefined();
    expect(screen.getByText("Paid Heart")).toBeDefined();
    expect(screen.getByText("Live Ranker")).toBeDefined();
    expect(screen.getByText("Total Ranker")).toBeDefined();
    expect(getAnyOnliveLogMock).toHaveBeenCalledWith("log-1");
    expect(getUserOnliveLogMock).not.toHaveBeenCalled();
  });

  it("一般ユーザーは自分のルームのログ詳細を表示する", async () => {
    setupAuthenticatedUser();
    getUserOnliveLogMock.mockResolvedValue(logDetail);

    await renderResolvedLogDetailPage();

    expect(screen.getByText("Archived hello")).toBeDefined();
    expect(getUserOnliveLogMock).toHaveBeenCalledWith("user-1", "log-1");
    expect(getAnyOnliveLogMock).not.toHaveBeenCalled();
  });

  it("対象ログがない場合は notFound を呼ぶ", async () => {
    setupAuthenticatedUser();
    getUserOnliveLogMock.mockResolvedValue(null);

    await expect(
      LogDetailPage({ params: Promise.resolve({ logId: "missing-log" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(getUserOnliveLogMock).toHaveBeenCalledWith("user-1", "missing-log");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("ユーザーアバターをクリックしてブロック操作を実行できる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;

        if (url.startsWith("/api/room/user-profile")) {
          return new Response(
            JSON.stringify({
              profile: {
                activeFanLevel: null,
                avatarId: null,
                avatarUrl: null,
                classLevel: null,
                description: "",
                fanLevel: null,
                imageUrl: null,
                isSmsAuthenticated: false,
                name: "Fetched Name",
                snsList: [],
                roomProfile: null,
              },
            }),
            { headers: { "Content-Type": "application/json" }, status: 200 },
          );
        }

        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }),
    );

    setupAuthenticatedUser();
    getUserOnliveLogMock.mockResolvedValue(logDetail);

    await renderResolvedLogDetailPage();

    expect(await screen.findByText("Archived hello")).toBeDefined();

    fireEvent.click(screen.getByTitle("Open Comment User profile"));

    expect(await screen.findByRole("dialog")).toBeDefined();

    const blockButton = await screen.findByRole("button", {
      name: "このユーザーをブロック",
    });
    fireEvent.click(blockButton);

    await waitFor(() => {
      expect(blockUserMock).toHaveBeenCalledWith("10", expect.any(String));
    });
  });
});
