import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./page";

const {
  authMock,
  getUserRegisteredRoomMock,
  hasTopAdminRoleMock,
  hasPremiumRoleMock,
  listUserInvitationCodesMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserRegisteredRoomMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
  hasPremiumRoleMock: vi.fn(),
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

vi.mock("@/lib/authz", () => ({
  hasTopAdminRole: hasTopAdminRoleMock,
  hasPremiumRole: hasPremiumRoleMock,
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

vi.mock("@/components/settings/generate-invitation-code-button", () => ({
  GenerateInvitationCodeButton: () => (
    <button data-testid="generate-invitation-code-button">招待コード生成</button>
  ),
}));

const settingsTitle = "設定";
const roleHeading = "権限";
const generalInvitationHeading = "招待コード（最大3名まで招待することができます）";
const activeLabel = "有効";
const inactiveLabel = "無効";
const emptyInvitationMessage = "招待コードはありません";

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

// RTL's getByText only matches direct text nodes, not text split across child elements.
// Use this helper to find the role description paragraph by its full textContent.
function getRoleDescriptionText(): string {
  const el = screen.getByText(
    (_, element) =>
      element?.tagName === "P" &&
      /あなたは.+ユーザーです/.test(element.textContent ?? ""),
  );
  return el.textContent ?? "";
}

beforeEach(() => {
  hasTopAdminRoleMock.mockResolvedValue(false);
  hasPremiumRoleMock.mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
  authMock.mockReset();
  getUserRegisteredRoomMock.mockReset();
  hasTopAdminRoleMock.mockReset();
  hasPremiumRoleMock.mockReset();
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
    expect(screen.getByRole("heading", { level: 2, name: roleHeading })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: generalInvitationHeading })).toBeDefined();
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

  it("displays 一般 role label for general users", async () => {
    authMock.mockResolvedValue(session);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([]);

    await renderSettingsPage();

    expect(screen.getByRole("heading", { level: 2, name: roleHeading })).toBeDefined();
    expect(getRoleDescriptionText()).toBe("あなたは一般ユーザーです");
  });

  it("displays プレミアム role label for premium users", async () => {
    authMock.mockResolvedValue(session);
    hasPremiumRoleMock.mockResolvedValue(true);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([]);

    await renderSettingsPage();

    expect(getRoleDescriptionText()).toBe("あなたはプレミアムユーザーです");
  });

  it("displays 管理者 role label for admin users", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([]);

    await renderSettingsPage();

    expect(getRoleDescriptionText()).toBe("あなたは管理者ユーザーです");
  });

  it("displays 管理者 role label when the user has both admin and premium roles", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    hasPremiumRoleMock.mockResolvedValue(true);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([]);

    await renderSettingsPage();

    expect(getRoleDescriptionText()).toBe("あなたは管理者ユーザーです");
  });

  it("shows the generate invitation code button for admin users", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([]);

    await renderSettingsPage();

    expect(screen.getByTestId("generate-invitation-code-button")).toBeDefined();
  });

  it("does not show the generate invitation code button for non-admin users", async () => {
    authMock.mockResolvedValue(session);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([]);

    await renderSettingsPage();

    expect(screen.queryByTestId("generate-invitation-code-button")).toBeNull();
  });

  it("shows admin invitation heading with correct counts", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([
      { code: "AAAA111111", isActive: true },
      { code: "BBBB222222", isActive: true },
      { code: "CCCC333333", isActive: false },
    ]);

    await renderSettingsPage();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "招待コード（現在2名招待できるコードがあります　未利用：2件　使用済み：1件）",
      }),
    ).toBeDefined();
  });

  it("shows general invitation heading for non-admin users", async () => {
    authMock.mockResolvedValue(session);
    getUserRegisteredRoomMock.mockResolvedValue(registeredRoom);
    listUserInvitationCodesMock.mockResolvedValue([]);

    await renderSettingsPage();

    expect(
      screen.getByRole("heading", { level: 2, name: generalInvitationHeading }),
    ).toBeDefined();
  });
});
