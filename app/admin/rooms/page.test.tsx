import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminRoomsPage from "./page";

const {
  authMock,
  hasTopAdminRoleMock,
  listAllRegisteredRoomsMock,
  redirectMock,
  toJstWallTimeIsoStringMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
  listAllRegisteredRoomsMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  toJstWallTimeIsoStringMock: vi.fn((d: Date) => d.toISOString()),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/authz", () => ({
  hasTopAdminRole: hasTopAdminRoleMock,
}));

vi.mock("@/lib/user-registered-room", () => ({
  listAllRegisteredRooms: listAllRegisteredRoomsMock,
}));

vi.mock("@/lib/jst", () => ({
  toJstWallTimeIsoString: toJstWallTimeIsoStringMock,
}));

vi.mock("@/components/navigation/app-sidebar", () => ({
  AppShell: ({
    activeKey,
    children,
    isAdmin,
  }: {
    activeKey?: string;
    children: ReactNode;
    isAdmin?: boolean;
  }) => (
    <div
      data-active-key={activeKey}
      data-is-admin={String(isAdmin ?? false)}
      data-testid="app-shell"
    >
      {children}
    </div>
  ),
}));

const session = {
  user: {
    id: "user-1",
  },
};

const room = {
  id: "reg-1",
  roomId: "12345",
  roomUrl: "alpha-room",
  roomName: "Alpha Room",
  imageUrl: null,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  user: {
    id: "user-1",
    name: "User One",
    isPremium: false,
    isAdmin: false,
  },
};

async function renderPage() {
  render(await AdminRoomsPage());
}

beforeEach(() => {
  hasTopAdminRoleMock.mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
  authMock.mockReset();
  hasTopAdminRoleMock.mockReset();
  listAllRegisteredRoomsMock.mockReset();
  redirectMock.mockClear();
  toJstWallTimeIsoStringMock.mockReset();
});

describe("AdminRoomsPage", () => {
  it("redirects to login when the user is not authenticated", async () => {
    authMock.mockResolvedValue(null);

    await expect(AdminRoomsPage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(hasTopAdminRoleMock).not.toHaveBeenCalled();
    expect(listAllRegisteredRoomsMock).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard when the user is not an admin", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(false);

    await expect(AdminRoomsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(hasTopAdminRoleMock).toHaveBeenCalledWith("user-1");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(listAllRegisteredRoomsMock).not.toHaveBeenCalled();
  });

  it("renders the room list page for admin users", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([room]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    const shell = screen.getByTestId("app-shell");
    expect(shell.getAttribute("data-active-key")).toBe("admin-rooms");
    expect(shell.getAttribute("data-is-admin")).toBe("true");
    expect(screen.getByRole("heading", { name: "ルーム一覧 1件" })).toBeDefined();
  });

  it("renders room name and room ID", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([room]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    expect(screen.getByText("Alpha Room")).toBeDefined();
    expect(screen.getByText("12345")).toBeDefined();
    expect(screen.getByText("User One")).toBeDefined();
  });

  it("renders profile and stream page links for each room", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([room]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    const profileLink = screen.getByRole("link", { name: /プロフィール/ });
    expect(profileLink.getAttribute("href")).toBe(
      "https://www.showroom-live.com/room/profile?room_id=12345",
    );

    const streamLink = screen.getByRole("link", { name: /配信ページ/ });
    expect(streamLink.getAttribute("href")).toBe(
      "https://www.showroom-live.com/r/alpha-room",
    );
  });

  it("renders an empty state when there are no registered rooms", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([]);

    await renderPage();

    expect(screen.getByRole("heading", { name: "ルーム一覧 0件" })).toBeDefined();
    expect(screen.getByText("登録済みルームはありません。")).toBeDefined();
  });

  it("renders fallback name when room name is null", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([
      { ...room, roomName: null },
    ]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    expect(screen.getByText("alpha-room")).toBeDefined();
  });

  it("renders role select for each room", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([room]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    const select = screen.getByRole("combobox", { name: "ロール変更" }) as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe("general");
  });

  it("renders role select with premiumuser value for premium user", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([{ ...room, user: { ...room.user, isPremium: true } }]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    const select = screen.getByRole("combobox", { name: "ロール変更" }) as HTMLSelectElement;
    expect(select.value).toBe("premiumuser");
  });

  it("does not render role select for admin users", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([{ ...room, user: { ...room.user, isAdmin: true } }]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    expect(screen.queryByRole("combobox", { name: "ロール変更" })).toBeNull();
  });

  it("toJstWallTimeIsoString を room.createdAt で呼び出す", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([room]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T09:00:00.000+09:00");

    await renderPage();

    expect(toJstWallTimeIsoStringMock).toHaveBeenCalledWith(room.createdAt);
  });

  it("renders multiple rooms with correct links", async () => {
    const room2 = {
      id: "reg-2",
      roomId: "99999",
      roomUrl: "beta-room",
      roomName: "Beta Room",
      imageUrl: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      user: { id: "user-2", name: "User Two", isPremium: true, isAdmin: false },
    };
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllRegisteredRoomsMock.mockResolvedValue([room, room2]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    expect(screen.getByRole("heading", { name: "ルーム一覧 2件" })).toBeDefined();
    expect(screen.getByText("Alpha Room")).toBeDefined();
    expect(screen.getByText("Beta Room")).toBeDefined();

    const profileLinks = screen.getAllByRole("link", { name: /プロフィール/ });
    expect(profileLinks).toHaveLength(2);
    expect(profileLinks[0].getAttribute("href")).toBe(
      "https://www.showroom-live.com/room/profile?room_id=12345",
    );
    expect(profileLinks[1].getAttribute("href")).toBe(
      "https://www.showroom-live.com/room/profile?room_id=99999",
    );
  });
});
