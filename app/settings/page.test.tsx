import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./page";

const {
  authMock,
  getUserRegisteredRoomMock,
  listUserInvitationCodesMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserRegisteredRoomMock: vi.fn(),
  listUserInvitationCodesMock: vi.fn(),
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

vi.mock("@/lib/invitations", () => ({
  listUserInvitationCodes: listUserInvitationCodesMock,
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

const settingsTitle = "\u8a2d\u5b9a";
const invitationHeading =
  "\u62db\u5f85\u30b3\u30fc\u30c9\uff08\u6700\u59273\u540d\u307e\u3067\u62db\u5f85\u3059\u308b\u3053\u3068\u304c\u3067\u304d\u307e\u3059\uff09";
const activeLabel = "\u6709\u52b9";
const inactiveLabel = "\u7121\u52b9";
const emptyInvitationMessage =
  "\u62db\u5f85\u30b3\u30fc\u30c9\u306f\u3042\u308a\u307e\u305b\u3093";

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

async function renderSettingsPage() {
  render(await SettingsPage());
}

afterEach(() => {
  cleanup();
  authMock.mockReset();
  getUserRegisteredRoomMock.mockReset();
  listUserInvitationCodesMock.mockReset();
  redirectMock.mockClear();
});

describe("SettingsPage", () => {
  it("redirects to login when the user is not authenticated", async () => {
    authMock.mockResolvedValue(null);

    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(getUserRegisteredRoomMock).not.toHaveBeenCalled();
    expect(listUserInvitationCodesMock).not.toHaveBeenCalled();
  });

  it("redirects to search when the user has no registered room", async () => {
    authMock.mockResolvedValue(session);
    getUserRegisteredRoomMock.mockResolvedValue(null);
    listUserInvitationCodesMock.mockResolvedValue([]);

    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT:/search");

    expect(getUserRegisteredRoomMock).toHaveBeenCalledWith("user-1");
    expect(listUserInvitationCodesMock).toHaveBeenCalledWith("user-1");
    expect(redirectMock).toHaveBeenCalledWith("/search");
  });

  it("renders active and inactive invitation codes", async () => {
    authMock.mockResolvedValue(session);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([
      {
        code: "ABCD123456",
        isActive: true,
      },
      {
        code: "WXYZ987654",
        isActive: false,
      },
    ]);

    await renderSettingsPage();

    expect(screen.getByTestId("app-shell").getAttribute("data-active-key")).toBe(
      "settings",
    );
    expect(screen.getByRole("heading", { level: 1, name: settingsTitle })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: invitationHeading })).toBeDefined();
    expect(screen.getByText("ABCD123456")).toBeDefined();
    expect(screen.getByText("WXYZ987654")).toBeDefined();
    expect(screen.getByText(activeLabel)).toBeDefined();
    expect(screen.getByText(inactiveLabel)).toBeDefined();
  });

  it("renders an empty state when the user has no invitation codes", async () => {
    authMock.mockResolvedValue(session);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([]);

    await renderSettingsPage();

    expect(screen.getByRole("heading", { level: 1, name: settingsTitle })).toBeDefined();
    expect(screen.getByText(emptyInvitationMessage)).toBeDefined();
    expect(screen.queryByText(activeLabel)).toBeNull();
    expect(screen.queryByText(inactiveLabel)).toBeNull();
  });
});
