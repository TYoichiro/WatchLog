import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./page";

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

vi.mock("@/components/navigation/app-sidebar", () => ({
  AppShell: ({
    children,
    isAdmin,
    isPremium,
  }: {
    children: ReactNode;
    isAdmin?: boolean;
    isPremium?: boolean;
  }) => (
    <div
      data-is-admin={String(isAdmin ?? false)}
      data-is-premium={String(isPremium ?? false)}
      data-testid="app-shell"
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/rescue/rescue-page-loader", () => ({
  RescuePage: () => <div data-testid="rescue-page" />,
}));

const session = { user: { id: "user-1" } };

async function renderPage() {
  render(await Page());
}

beforeEach(() => {
  getUserRolesMock.mockResolvedValue({ isAdmin: false, isPremium: false });
});

afterEach(() => {
  cleanup();
  authMock.mockReset();
  getUserRolesMock.mockReset();
  redirectMock.mockClear();
});

describe("rescue/page (サーバーコンポーネント)", () => {
  it("未認証の場合 / にリダイレクトする", async () => {
    authMock.mockResolvedValue(null);

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(getUserRolesMock).not.toHaveBeenCalled();
  });

  it("admin でも premium でもない場合 /dashboard にリダイレクトする", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: false, isPremium: false });

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("プレミアムユーザーの場合ページを表示する", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: false, isPremium: true });

    await renderPage();

    const shell = screen.getByTestId("app-shell");
    expect(shell.getAttribute("data-is-admin")).toBe("false");
    expect(shell.getAttribute("data-is-premium")).toBe("true");
    expect(screen.getByTestId("rescue-page")).toBeDefined();
  });

  it("管理者の場合ページを表示する", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    await renderPage();

    const shell = screen.getByTestId("app-shell");
    expect(shell.getAttribute("data-is-admin")).toBe("true");
    expect(screen.getByTestId("rescue-page")).toBeDefined();
  });

  it("管理者かつプレミアムの場合もページを表示する", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: true });

    await renderPage();

    expect(screen.getByTestId("rescue-page")).toBeDefined();
  });

  it("getUserRoles を session の userId で呼び出す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    await renderPage();

    expect(getUserRolesMock).toHaveBeenCalledWith("user-1");
  });

  it("未認証の場合は getUserRoles を呼び出さない", async () => {
    authMock.mockResolvedValue(null);

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(getUserRolesMock).not.toHaveBeenCalled();
  });

  it("RescuePage コンポーネントを AppShell 内にレンダリングする", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: false, isPremium: true });

    await renderPage();

    const shell = screen.getByTestId("app-shell");
    expect(shell.contains(screen.getByTestId("rescue-page"))).toBe(true);
  });
});
