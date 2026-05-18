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
  hasPremiumRoleMock,
  listAllOnliveLogsMock,
  listUserOnliveLogsMock,
  redirectMock,
  routerPush,
  routerRefresh,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserRegisteredRoomMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
  hasPremiumRoleMock: vi.fn(),
  listAllOnliveLogsMock: vi.fn(),
  listUserOnliveLogsMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({
    push: routerPush,
    refresh: routerRefresh,
  }),
}));

vi.mock("@/lib/authz", () => ({
  hasTopAdminRole: hasTopAdminRoleMock,
  hasPremiumRole: hasPremiumRoleMock,
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

const pageTitle = "ログ一覧";
const emptyMessage =
  "保存済みログはまだありません。配信終了時にログが保存されます。";
const deleteDialogTitle =
  "ログを削除しますか？";
const confirmDeleteLabel = "はい";
const formattedCapturedAt = "2026/05/09(土) 12:00:00";

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

function setupAuthenticatedUser({
  isAdmin = false,
  isPremium = true,
}: { isAdmin?: boolean; isPremium?: boolean } = {}) {
  authMock.mockResolvedValue(session);
  hasTopAdminRoleMock.mockResolvedValue(isAdmin);
  hasPremiumRoleMock.mockResolvedValue(isPremium);
}

async function renderLogsPage() {
  render(await LogsPage());
}

// Saved originals for URL download methods (may not exist in jsdom)
type UrlWithDownloadMethods = typeof URL & {
  createObjectURL?: (typeof URL)["createObjectURL"];
  revokeObjectURL?: (typeof URL)["revokeObjectURL"];
};
const savedUrlMethods: {
  createObjectURL?: (typeof URL)["createObjectURL"];
  revokeObjectURL?: (typeof URL)["revokeObjectURL"];
} = {};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  authMock.mockReset();
  getUserRegisteredRoomMock.mockReset();
  hasTopAdminRoleMock.mockReset();
  hasPremiumRoleMock.mockReset();
  listAllOnliveLogsMock.mockReset();
  listUserOnliveLogsMock.mockReset();
  redirectMock.mockClear();
  routerPush.mockReset();
  routerRefresh.mockReset();
  fetchMock.mockReset();
  // Restore URL download methods to their saved originals
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: savedUrlMethods.createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: savedUrlMethods.revokeObjectURL,
  });
});

function setupDownloadMocks() {
  const revokeObjectURL = vi.fn();
  // Save originals before overriding (may be undefined in jsdom)
  savedUrlMethods.createObjectURL = (URL as UrlWithDownloadMethods).createObjectURL;
  savedUrlMethods.revokeObjectURL = (URL as UrlWithDownloadMethods).revokeObjectURL;
  // Use Object.defineProperty to work regardless of whether the property
  // previously existed, is writable, or is configurable
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:mock-url"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  });
  return revokeObjectURL;
}

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
    expect(screen.getByRole("heading", { name: `${pageTitle} 1件` })).toBeDefined();
    expect(screen.getByText(formattedCapturedAt)).toBeDefined();
    expect(screen.getByText("Live ID: live-1")).toBeDefined();
    expect(screen.getByText("コメント 12")).toBeDefined();
    expect(screen.getByText("ギフト 3")).toBeDefined();

    const viewLink = screen.getByRole("link", { name: /閲覧/ });
    expect(viewLink.getAttribute("href")).toBe("/logs/log-1");
    expect(listAllOnliveLogsMock).toHaveBeenCalledTimes(1);
    expect(getUserRegisteredRoomMock).not.toHaveBeenCalled();
    expect(listUserOnliveLogsMock).not.toHaveBeenCalled();
  });

  it("redirects non-admin users without a registered room to search", async () => {
    setupAuthenticatedUser();
    getUserRegisteredRoomMock.mockResolvedValue(null);

    await expect(LogsPage()).rejects.toThrow("NEXT_REDIRECT:/search");

    expect(getUserRegisteredRoomMock).toHaveBeenCalledWith("user-1");
    expect(listUserOnliveLogsMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/search");
  });

  it("renders the current user's logs for premium non-admin users", async () => {
    setupAuthenticatedUser({ isPremium: true });
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserOnliveLogsMock.mockResolvedValue([onliveLog]);

    await renderLogsPage();

    expect(screen.getByRole("heading", { name: `${pageTitle} 1件` })).toBeDefined();
    expect(screen.getByText(formattedCapturedAt)).toBeDefined();
    expect(listAllOnliveLogsMock).not.toHaveBeenCalled();
    expect(listUserOnliveLogsMock).toHaveBeenCalledWith("user-1");
  });

  it("renders an empty log list for non-premium users", async () => {
    setupAuthenticatedUser({ isPremium: false });
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);

    await renderLogsPage();

    expect(screen.getByRole("heading", { name: `${pageTitle} 0件` })).toBeDefined();
    expect(screen.getByText(emptyMessage)).toBeDefined();
    expect(listUserOnliveLogsMock).not.toHaveBeenCalled();
  });
});

describe("LogListPage", () => {
  it("renders an empty state when there are no saved logs", () => {
    render(<LogListPage initialLogs={[]} />);

    expect(screen.getByRole("heading", { name: `${pageTitle} 0件` })).toBeDefined();
    expect(screen.getByText(emptyMessage)).toBeDefined();
  });

  it("confirms and deletes a log", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    render(<LogListPage initialLogs={[logListItem]} />);

    fireEvent.click(screen.getByRole("button", { name: /削除/ }));

    expect(screen.getByRole("heading", { name: deleteDialogTitle })).toBeDefined();
    expect(
      screen.getByText(`${formattedCapturedAt} のログを削除します。`),
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
        { error: "ログを削除できません" },
        { status: 500 },
      ),
    );

    render(<LogListPage initialLogs={[logListItem]} />);

    fireEvent.click(screen.getByRole("button", { name: /削除/ }));
    fireEvent.click(screen.getByRole("button", { name: confirmDeleteLabel }));

    expect(await screen.findByText("ログを削除できません")).toBeDefined();
    expect(screen.getByText(formattedCapturedAt)).toBeDefined();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("non-premium users' 閲覧 link navigates to /logs/local/{roomId}", () => {
    const localLog = {
      capturedAt: "2026-05-09T12:00:00.000+09:00",
      commentCount: 5,
      giftCount: 2,
      liveId: "live-local-1",
      liveRankingCount: 3,
      log: {},
      roomId: "12345",
      roomName: "Alpha Room",
      savedAt: "2026-05-09T12:01:00.000+09:00",
    };
    window.localStorage.setItem(
      "watchlog:saved-log:12345",
      JSON.stringify(localLog),
    );

    render(<LogListPage initialLogs={[]} isPremium={false} roomId="12345" />);

    const viewLink = screen.getByRole("link", { name: /閲覧/ });
    expect(viewLink.getAttribute("href")).toBe("/logs/local/12345");
  });

  it("non-premium users can delete a local log", async () => {
    const localLog = {
      capturedAt: "2026-05-09T12:00:00.000+09:00",
      commentCount: 5,
      giftCount: 2,
      liveId: "live-local-1",
      liveRankingCount: 3,
      log: {},
      roomId: "12345",
      roomName: "Alpha Room",
      savedAt: "2026-05-09T12:01:00.000+09:00",
    };
    window.localStorage.setItem(
      "watchlog:saved-log:12345",
      JSON.stringify(localLog),
    );

    render(<LogListPage initialLogs={[]} isPremium={false} roomId="12345" />);

    expect(screen.getByRole("heading", { name: `${pageTitle} 1件` })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /削除/ }));
    fireEvent.click(screen.getByRole("button", { name: confirmDeleteLabel }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: `${pageTitle} 0件` })).toBeDefined();
    });
    expect(window.localStorage.getItem("watchlog:saved-log:12345")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads a DB log as JSON", async () => {
    const revokeObjectURL = setupDownloadMocks();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        capturedAt: "2026-05-09T12:00:00.000Z",
        liveId: "live-1",
        log: { comments: [] },
        roomId: "12345",
      }),
    );

    render(<LogListPage initialLogs={[logListItem]} />);
    fireEvent.click(screen.getByRole("button", { name: /ダウンロード/ }));

    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onlive/logs/log-1",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("non-premium users can download a local log", async () => {
    const revokeObjectURL = setupDownloadMocks();

    const localLog = {
      capturedAt: "2026-05-09T12:00:00.000+09:00",
      commentCount: 5,
      giftCount: 2,
      liveId: "live-local-1",
      liveRankingCount: 3,
      log: { comments: [] },
      roomId: "12345",
      roomName: "Alpha Room",
      savedAt: "2026-05-09T12:01:00.000+09:00",
    };
    window.localStorage.setItem(
      "watchlog:saved-log:12345",
      JSON.stringify(localLog),
    );

    render(<LogListPage initialLogs={[]} isPremium={false} roomId="12345" />);
    fireEvent.click(screen.getByRole("button", { name: /ダウンロード/ }));

    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("LogListPage - JSON import", () => {
  function getFileInput() {
    return document.querySelector('input[type="file"]') as HTMLInputElement;
  }

  function triggerFileChange(input: HTMLInputElement, file: File) {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    fireEvent.change(input);
  }

  it("有効なJSONファイルを選択すると/logs/json-importへ遷移する", async () => {
    render(<LogListPage initialLogs={[]} />);

    const validLog = {
      capturedAt: "2026-05-09T12:00:00.000+09:00",
      liveId: "live-1",
      log: { comments: [] },
      roomId: "12345",
    };
    const file = new File(
      [JSON.stringify(validLog)],
      "watchlog.json",
      { type: "application/json" },
    );

    triggerFileChange(getFileInput(), file);

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/logs/json-import");
    });
  });

  it("無効なJSONファイルを選択するとエラーメッセージを表示する", async () => {
    render(<LogListPage initialLogs={[]} />);

    const invalidLog = { foo: "bar" };
    const file = new File(
      [JSON.stringify(invalidLog)],
      "invalid.json",
      { type: "application/json" },
    );

    triggerFileChange(getFileInput(), file);

    expect(
      await screen.findByText("正しい形式のWatchLog JSONファイルではありません。"),
    ).toBeDefined();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("壊れたJSONファイルを選択するとエラーメッセージを表示する", async () => {
    render(<LogListPage initialLogs={[]} />);

    const file = new File(
      ["not valid json {{"],
      "broken.json",
      { type: "application/json" },
    );

    triggerFileChange(getFileInput(), file);

    expect(
      await screen.findByText("JSONファイルの読み込みに失敗しました。"),
    ).toBeDefined();
    expect(routerPush).not.toHaveBeenCalled();
  });
});
