import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BlockPage from "./page";

const {
  authMock,
  getUserRegisteredRoomMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserRegisteredRoomMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/user-registered-room", () => ({
  getUserRegisteredRoom: getUserRegisteredRoomMock,
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

vi.mock("@/components/onlive/onlive-room-page", () => ({
  UserProfileModal: ({
    hasError,
    isLoading,
    profile,
    target,
  }: {
    hasError: boolean;
    isLoading: boolean;
    profile: { name?: string | null } | null;
    target: { userId: string; userName: string } | null;
  }) => {
    if (!target) {
      return null;
    }

    return (
      <div aria-label={`${target.userName} profile`} role="dialog">
        <p>{target.userId}</p>
        <p>{target.userName}</p>
        {isLoading ? <p>profile loading</p> : null}
        {hasError ? <p>profile error</p> : null}
        {profile?.name ? <p>{profile.name}</p> : null}
      </div>
    );
  },
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: ReactNode;
    open?: boolean;
  }) => (open ? <>{children}</> : null),
  AlertDialogAction: ({
    children,
    variant: _variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => {
    void _variant;

    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  },
  AlertDialogCancel: ({
    children,
    variant: _variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => {
    void _variant;

    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  },
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div role="alertdialog">{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

const pageTitle = "\u30d6\u30ed\u30c3\u30af\u30e6\u30fc\u30b6\u30fc";
const emptyMessage =
  "\u30d6\u30ed\u30c3\u30af\u4e2d\u306e\u30e6\u30fc\u30b6\u30fc\u306f\u3044\u307e\u305b\u3093\u3002";
const listErrorMessage =
  "\u30d6\u30ed\u30c3\u30af\u4e00\u89a7\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002";
const deleteDialogTitle = "\u524a\u9664\u3057\u307e\u3059\u304b\uff1f";
const confirmDeleteLabel = "\u306f\u3044";

const session = {
  user: {
    id: "user-1",
  },
};

const registeredRoom = {
  imageUrl: "https://static.showroom-live.com/room.jpg",
  roomId: "12345",
  roomName: "Alpha Room",
  roomUrl: "alpha-room",
};

const blockItem = {
  blockedUserId: "9001",
  blockedUserName: "Blocked User",
  createdAt: "2026-05-09T12:00:00.000Z",
  id: "block-1",
  updatedAt: "2026-05-09T12:00:00.000Z",
};

const fetchMock = vi.fn<typeof fetch>();

type FetchScenario = {
  blocks?: typeof blockItem[];
  blocksOk?: boolean;
  deleteOk?: boolean;
  profileOk?: boolean;
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
  blocks = [blockItem],
  blocksOk = true,
  deleteOk = true,
  profileOk = true,
}: FetchScenario = {}) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = getFetchUrl(input);
    const method = init?.method ?? "GET";

    if (url === "/api/blocks" && method === "GET") {
      if (!blocksOk) {
        return jsonResponse({ error: "Failed to list blocks" }, { status: 500 });
      }

      return jsonResponse({ blocks });
    }

    if (url === "/api/blocks/block-1" && method === "DELETE") {
      if (!deleteOk) {
        return jsonResponse(
          { error: "\u30d6\u30ed\u30c3\u30af\u89e3\u9664\u306b\u5931\u6557\u3057\u307e\u3057\u305f" },
          { status: 500 },
        );
      }

      return jsonResponse({ ok: true });
    }

    if (url.startsWith("/api/room/user-profile?")) {
      if (!profileOk) {
        return jsonResponse({ error: "Failed to fetch profile" }, { status: 500 });
      }

      return jsonResponse({
        profile: {
          name: "Fetched Profile",
        },
      });
    }

    throw new Error(`Unhandled fetch URL: ${url}`);
  });
}

function setupAuthenticatedPage() {
  authMock.mockResolvedValue(session);
  getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
}

async function renderBlockPage() {
  render(await BlockPage());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  authMock.mockReset();
  getUserRegisteredRoomMock.mockReset();
  redirectMock.mockClear();
  fetchMock.mockReset();
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

describe("BlockPage", () => {
  it("redirects to login when the user is not authenticated", async () => {
    authMock.mockResolvedValue(null);

    await expect(BlockPage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(getUserRegisteredRoomMock).not.toHaveBeenCalled();
  });

  it("redirects to search when the user has no registered room", async () => {
    authMock.mockResolvedValue(session);
    getUserRegisteredRoomMock.mockResolvedValue(null);

    await expect(BlockPage()).rejects.toThrow("NEXT_REDIRECT:/search");

    expect(getUserRegisteredRoomMock).toHaveBeenCalledWith("user-1");
    expect(redirectMock).toHaveBeenCalledWith("/search");
  });

  it("renders the block list for the registered room", async () => {
    setupAuthenticatedPage();
    setupFetchScenario();

    await renderBlockPage();

    expect(screen.getByTestId("app-shell").getAttribute("data-active-key")).toBe(
      "block",
    );
    expect(await screen.findByRole("heading", { name: `${pageTitle} 1\u4ef6` })).toBeDefined();
    expect(screen.getByText("9001")).toBeDefined();
    expect(screen.getByRole("button", { name: "Blocked User" })).toBeDefined();
    expect(screen.getByText("2026/05/09 21:00:00")).toBeDefined();
  });

  it("renders an empty state when there are no blocked users", async () => {
    setupAuthenticatedPage();
    setupFetchScenario({ blocks: [] });

    await renderBlockPage();

    expect(await screen.findByRole("heading", { name: `${pageTitle} 0\u4ef6` })).toBeDefined();
    expect(screen.getByText(emptyMessage)).toBeDefined();
  });

  it("renders an error state when the block list cannot be loaded", async () => {
    setupAuthenticatedPage();
    setupFetchScenario({ blocksOk: false });

    await renderBlockPage();

    expect(await screen.findByText(listErrorMessage)).toBeDefined();
  });

  it("loads a blocked user's profile when the user name is clicked", async () => {
    setupAuthenticatedPage();
    setupFetchScenario();

    await renderBlockPage();

    fireEvent.click(await screen.findByRole("button", { name: "Blocked User" }));

    expect(await screen.findByRole("dialog", { name: "Blocked User profile" })).toBeDefined();
    expect(await screen.findByText("Fetched Profile")).toBeDefined();

    const profileCall = fetchMock.mock.calls.find(([input]) =>
      getFetchUrl(input).startsWith("/api/room/user-profile?"),
    );

    expect(profileCall).toBeDefined();
    expect(getFetchUrl(profileCall![0])).toBe(
      "/api/room/user-profile?room_id=12345&user_id=9001",
    );
    expect(profileCall![1]).toEqual(expect.objectContaining({ cache: "no-store" }));
  });

  it("ブロック解除に失敗した場合はエラーメッセージを表示してユーザーを維持する", async () => {
    setupAuthenticatedPage();
    setupFetchScenario({ deleteOk: false });

    await renderBlockPage();

    fireEvent.click(await screen.findByRole("button", { name: /削除/ }));

    expect(screen.getByRole("heading", { name: deleteDialogTitle })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: confirmDeleteLabel }));

    expect(await screen.findByText("ブロック解除に失敗しました")).toBeDefined();
    expect(screen.getByText("Blocked User")).toBeDefined();
  });

  it("ユーザープロフィールの取得に失敗した場合はエラー状態を表示する", async () => {
    setupAuthenticatedPage();
    setupFetchScenario({ profileOk: false });

    await renderBlockPage();

    fireEvent.click(await screen.findByRole("button", { name: "Blocked User" }));

    expect(
      await screen.findByRole("dialog", { name: "Blocked User profile" }),
    ).toBeDefined();
    expect(await screen.findByText("profile error")).toBeDefined();
  });

  it("confirms and deletes a blocked user", async () => {
    setupAuthenticatedPage();
    setupFetchScenario();

    await renderBlockPage();

    fireEvent.click(await screen.findByRole("button", { name: /\u524a\u9664/ }));

    expect(screen.getByRole("heading", { name: deleteDialogTitle })).toBeDefined();
    expect(
      screen.getByText(
        "Blocked User \u306e\u30d6\u30ed\u30c3\u30af\u3092\u89e3\u9664\u3057\u307e\u3059\u3002",
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: confirmDeleteLabel }));

    await waitFor(() => {
      expect(screen.queryByText("Blocked User")).toBeNull();
    });
    expect(await screen.findByText(emptyMessage)).toBeDefined();

    const deleteCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        getFetchUrl(input) === "/api/blocks/block-1" && init?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
  });
});
