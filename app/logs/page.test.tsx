import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LogsPage from "./page";
import { LogListPage, type LogListItem } from "@/components/logs/log-list-page";
import type { OnliveLogListItem } from "@/lib/onlive-log";

const {
  authMock,
  getUserRegisteredRoomMock,
  hasTopAdminRoleMock,
  listAllOnliveLogsMock,
  listUserOnliveLogsMock,
  redirectMock,
  routerRefresh,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserRegisteredRoomMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
  listAllOnliveLogsMock: vi.fn(),
  listUserOnliveLogsMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  routerRefresh: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({
    refresh: routerRefresh,
  }),
}));

vi.mock("@/lib/authz", () => ({
  hasTopAdminRole: hasTopAdminRoleMock,
}));

vi.mock("@/lib/onlive-log", () => ({
  listAllOnliveLogs: listAllOnliveLogsMock,
  listUserOnliveLogs: listUserOnliveLogsMock,
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
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
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

const pageTitle = "\u30ed\u30b0\u4e00\u89a7";
const emptyMessage =
  "\u4fdd\u5b58\u6e08\u307f\u30ed\u30b0\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093\u3002\u914d\u4fe1\u7d42\u4e86\u6642\u306b\u30ed\u30b0\u304c\u4fdd\u5b58\u3055\u308c\u307e\u3059\u3002";
const deleteDialogTitle =
  "\u30ed\u30b0\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f";
const confirmDeleteLabel = "\u306f\u3044";
const formattedCapturedAt = "2026/05/09(\u571f) 12:00:00";

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

const onliveLog: OnliveLogListItem = {
  capturedAt: new Date(Date.UTC(2026, 4, 9, 12, 0, 0)),
  commentCount: 12,
  createdAt: new Date(Date.UTC(2026, 4, 9, 12, 1, 0)),
  giftCount: 3,
  id: "log-1",
  liveId: "live-1",
  liveRankingCount: 4,
  roomId: "12345",
  roomName: "Alpha Room",
  totalRankingCount: 5,
  updatedAt: new Date(Date.UTC(2026, 4, 9, 12, 2, 0)),
};

const logListItem: LogListItem = {
  capturedAt: "2026-05-09T12:00:00.000+09:00",
  commentCount: 12,
  createdAt: "2026-05-09T12:01:00.000+09:00",
  giftCount: 3,
  id: "log-1",
  liveId: "live-1",
  liveRankingCount: 4,
  roomId: "12345",
  roomName: "Alpha Room",
  totalRankingCount: 5,
  updatedAt: "2026-05-09T12:02:00.000+09:00",
};

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
    ...init,
  });
}

function setupAuthenticatedUser({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  authMock.mockResolvedValue(session);
  hasTopAdminRoleMock.mockResolvedValue(isAdmin);
}

async function renderLogsPage() {
  render(await LogsPage());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  authMock.mockReset();
  getUserRegisteredRoomMock.mockReset();
  hasTopAdminRoleMock.mockReset();
  listAllOnliveLogsMock.mockReset();
  listUserOnliveLogsMock.mockReset();
  redirectMock.mockClear();
  routerRefresh.mockReset();
  fetchMock.mockReset();
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

describe("LogsPage", () => {
  it("redirects to login when the user is not authenticated", async () => {
    authMock.mockResolvedValue(null);

    await expect(LogsPage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(hasTopAdminRoleMock).not.toHaveBeenCalled();
  });

  it("renders all logs for top admins", async () => {
    setupAuthenticatedUser({ isAdmin: true });
    listAllOnliveLogsMock.mockResolvedValue([onliveLog]);

    await renderLogsPage();

    expect(screen.getByTestId("app-shell").getAttribute("data-active-key")).toBe(
      "logs",
    );
    expect(screen.getByRole("heading", { name: `${pageTitle} 1\u4ef6` })).toBeDefined();
    expect(screen.getByText(formattedCapturedAt)).toBeDefined();
    expect(screen.getByText("Live ID: live-1")).toBeDefined();
    expect(screen.getByText("\u30b3\u30e1\u30f3\u30c8 12")).toBeDefined();
    expect(screen.getByText("\u30ae\u30d5\u30c8 3")).toBeDefined();

    const viewLink = screen.getByRole("link", { name: /\u95b2\u89a7/ });
    expect(viewLink.getAttribute("href")).toBe("/logs/log-1");
    expect(listAllOnliveLogsMock).toHaveBeenCalledTimes(1);
    expect(getUserRegisteredRoomMock).not.toHaveBeenCalled();
    expect(listUserOnliveLogsMock).not.toHaveBeenCalled();
  });

  it("redirects non-admin users without a registered room to search", async () => {
    setupAuthenticatedUser();
    getUserRegisteredRoomMock.mockResolvedValue(null);
    listUserOnliveLogsMock.mockResolvedValue([]);

    await expect(LogsPage()).rejects.toThrow("NEXT_REDIRECT:/search");

    expect(getUserRegisteredRoomMock).toHaveBeenCalledWith("user-1");
    expect(listUserOnliveLogsMock).toHaveBeenCalledWith("user-1");
    expect(redirectMock).toHaveBeenCalledWith("/search");
  });

  it("renders the current user's logs for non-admin users", async () => {
    setupAuthenticatedUser();
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserOnliveLogsMock.mockResolvedValue([onliveLog]);

    await renderLogsPage();

    expect(screen.getByRole("heading", { name: `${pageTitle} 1\u4ef6` })).toBeDefined();
    expect(screen.getByText(formattedCapturedAt)).toBeDefined();
    expect(listAllOnliveLogsMock).not.toHaveBeenCalled();
  });
});

describe("LogListPage", () => {
  it("renders an empty state when there are no saved logs", () => {
    render(<LogListPage initialLogs={[]} />);

    expect(screen.getByRole("heading", { name: `${pageTitle} 0\u4ef6` })).toBeDefined();
    expect(screen.getByText(emptyMessage)).toBeDefined();
  });

  it("confirms and deletes a log", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    render(<LogListPage initialLogs={[logListItem]} />);

    fireEvent.click(screen.getByRole("button", { name: /\u524a\u9664/ }));

    expect(screen.getByRole("heading", { name: deleteDialogTitle })).toBeDefined();
    expect(
      screen.getByText(`${formattedCapturedAt} \u306e\u30ed\u30b0\u3092\u524a\u9664\u3057\u307e\u3059\u3002`),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: confirmDeleteLabel }));

    await waitFor(() => {
      expect(screen.queryByText(formattedCapturedAt)).toBeNull();
    });
    expect(screen.getByText(emptyMessage)).toBeDefined();
    expect(routerRefresh).toHaveBeenCalledTimes(1);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onlive/logs/log-1",
      expect.objectContaining({
        cache: "no-store",
        method: "DELETE",
      }),
    );
  });

  it("shows the delete error and keeps the log when deletion fails", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: "\u30ed\u30b0\u3092\u524a\u9664\u3067\u304d\u307e\u305b\u3093" },
        { status: 500 },
      ),
    );

    render(<LogListPage initialLogs={[logListItem]} />);

    fireEvent.click(screen.getByRole("button", { name: /\u524a\u9664/ }));
    fireEvent.click(screen.getByRole("button", { name: confirmDeleteLabel }));

    expect(await screen.findByText("\u30ed\u30b0\u3092\u524a\u9664\u3067\u304d\u307e\u305b\u3093")).toBeDefined();
    expect(screen.getByText(formattedCapturedAt)).toBeDefined();
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
