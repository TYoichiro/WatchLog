import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  hasTopAdminRoleMock,
  findManyMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
  findManyMock: vi.fn(),
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
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dashboardNotice: {
      findMany: findManyMock,
    },
  },
}));

vi.mock("@/components/navigation/app-sidebar", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

vi.mock("@/components/admin/notices-page", () => ({
  NoticesPage: ({
    initialNotices,
  }: {
    initialNotices: unknown[];
  }) => (
    <div data-testid="notices-page" data-count={initialNotices.length}>
      お知らせ管理
    </div>
  ),
}));

import Page from "./page";

const mockNotice = {
  id: 1,
  title: "テストお知らせ",
  content: "テスト本文",
  displayTarget: "AUTHENTICATED" as const,
  publishedAt: new Date("2024-01-01T01:00:00.000Z"),
  expiresAt: null,
  linkUrl: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

afterEach(() => {
  cleanup();
  authMock.mockReset();
  hasTopAdminRoleMock.mockReset();
  findManyMock.mockReset();
  redirectMock.mockClear();
});

describe("Admin Notices Page", () => {
  it("未認証の場合は / へリダイレクトする", async () => {
    authMock.mockResolvedValue(null);

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("認証済みだが管理者でない場合は /dashboard へリダイレクトする", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    hasTopAdminRoleMock.mockResolvedValue(false);

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("管理者の場合は NoticesPage を表示する", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1" } });
    hasTopAdminRoleMock.mockResolvedValue(true);
    findManyMock.mockResolvedValue([mockNotice]);

    render(await Page());
    expect(screen.getByTestId("notices-page")).toBeDefined();
  });

  it("お知らせ一覧を NoticesPage に渡す", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1" } });
    hasTopAdminRoleMock.mockResolvedValue(true);
    findManyMock.mockResolvedValue([mockNotice, { ...mockNotice, id: 2 }]);

    render(await Page());
    expect(screen.getByTestId("notices-page").getAttribute("data-count")).toBe("2");
  });

  it("お知らせが存在しない場合は空配列を NoticesPage に渡す", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1" } });
    hasTopAdminRoleMock.mockResolvedValue(true);
    findManyMock.mockResolvedValue([]);

    render(await Page());
    expect(screen.getByTestId("notices-page").getAttribute("data-count")).toBe("0");
  });

  it("AppShell 内に NoticesPage をレンダリングする", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1" } });
    hasTopAdminRoleMock.mockResolvedValue(true);
    findManyMock.mockResolvedValue([]);

    render(await Page());
    const shell = screen.getByTestId("app-shell");
    expect(shell.contains(screen.getByTestId("notices-page"))).toBe(true);
  });

  it("hasTopAdminRole を正しい userId で呼び出す", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-user-id" } });
    hasTopAdminRoleMock.mockResolvedValue(true);
    findManyMock.mockResolvedValue([]);

    await Page();
    expect(hasTopAdminRoleMock).toHaveBeenCalledWith("admin-user-id");
  });
});
