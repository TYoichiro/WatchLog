import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LocalLogPage from "./page";

const { authMock, getUserRolesMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getUserRolesMock: vi.fn(),
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
  getUserRoles: getUserRolesMock,
}));

vi.mock("@/components/logs/local-log-viewer-page", () => ({
  LocalLogViewerPage: ({
    roomId,
    isAdmin,
    isPremium,
  }: {
    roomId: string;
    isAdmin?: boolean;
    isPremium?: boolean;
  }) => (
    <div
      data-testid="local-log-viewer"
      data-room-id={roomId}
      data-is-admin={String(!!isAdmin)}
      data-is-premium={String(!!isPremium)}
    />
  ),
}));

const session = {
  user: {
    id: "user-1",
  },
};

afterEach(() => {
  cleanup();
  authMock.mockReset();
  getUserRolesMock.mockReset();
  redirectMock.mockClear();
});

describe("LocalLogPage", () => {
  it("未ログインの場合はログイン画面へ遷移する", async () => {
    authMock.mockResolvedValue(null);

    await expect(
      LocalLogPage({ params: Promise.resolve({ roomId: "12345" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("ログイン済みの場合はroomIdとロール情報を渡してLocalLogViewerPageを表示する", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    render(
      await LocalLogPage({ params: Promise.resolve({ roomId: "12345" }) }),
    );

    const viewer = screen.getByTestId("local-log-viewer");
    expect(viewer.getAttribute("data-room-id")).toBe("12345");
    expect(viewer.getAttribute("data-is-admin")).toBe("true");
    expect(viewer.getAttribute("data-is-premium")).toBe("false");
  });
});
