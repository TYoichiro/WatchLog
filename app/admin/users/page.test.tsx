import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminUsersPage from "./page";

const {
  authMock,
  hasTopAdminRoleMock,
  userFindManyMock,
  redirectMock,
  toJstWallTimeIsoStringMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
  userFindManyMock: vi.fn(),
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: userFindManyMock },
  },
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

const session = { user: { id: "admin-1" } };

const dbUser = {
  id: "user-1",
  name: "User One",
  email: "user1@example.com",
  image: null,
  isBanned: false,
  createdAt: new Date("2026-05-01T00:00:00Z"),
  userRoles: [{ role: { name: "user" } }],
  registeredRoom: null,
};

async function renderPage() {
  render(await AdminUsersPage());
}

beforeEach(() => {
  hasTopAdminRoleMock.mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
  authMock.mockReset();
  hasTopAdminRoleMock.mockReset();
  userFindManyMock.mockReset();
  redirectMock.mockClear();
  toJstWallTimeIsoStringMock.mockReset();
});

describe("AdminUsersPage", () => {
  it("未認証の場合 / へリダイレクトする", async () => {
    authMock.mockResolvedValue(null);

    await expect(AdminUsersPage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(hasTopAdminRoleMock).not.toHaveBeenCalled();
    expect(userFindManyMock).not.toHaveBeenCalled();
  });

  it("管理者でない場合 /dashboard へリダイレクトする", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(false);

    await expect(AdminUsersPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(hasTopAdminRoleMock).toHaveBeenCalledWith("admin-1");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(userFindManyMock).not.toHaveBeenCalled();
  });

  it("管理者の場合ユーザー一覧ページをレンダリングする", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    userFindManyMock.mockResolvedValue([dbUser]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    const shell = screen.getByTestId("app-shell");
    expect(shell.getAttribute("data-active-key")).toBe("admin-users");
    expect(shell.getAttribute("data-is-admin")).toBe("true");
    expect(screen.getByRole("heading", { name: "ユーザー一覧 1件" })).toBeDefined();
  });

  it("ユーザー名・メールアドレスを表示する", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    userFindManyMock.mockResolvedValue([dbUser]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    expect(screen.getByText("User One")).toBeDefined();
    expect(screen.getByText("user1@example.com")).toBeDefined();
  });

  it("ユーザーがいない場合は空状態を表示する", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    userFindManyMock.mockResolvedValue([]);

    await renderPage();

    expect(screen.getByRole("heading", { name: "ユーザー一覧 0件" })).toBeDefined();
    expect(screen.getByText("ユーザーはいません。")).toBeDefined();
  });

  it("BAN セレクトを表示する（管理者本人以外）", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    userFindManyMock.mockResolvedValue([dbUser]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    const select = screen.getByRole("combobox", { name: "ステータス変更" }) as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe("allowed");
  });

  it("BAN 済みユーザーの場合セレクトの初期値が banned", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    userFindManyMock.mockResolvedValue([{ ...dbUser, isBanned: true }]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    const select = screen.getByRole("combobox", { name: "ステータス変更" }) as HTMLSelectElement;
    expect(select.value).toBe("banned");
  });

  it("ログイン中のユーザー自身は操作不可を表示する", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    hasTopAdminRoleMock.mockResolvedValue(true);
    userFindManyMock.mockResolvedValue([{ ...dbUser, id: "user-1" }]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    expect(screen.queryByRole("combobox", { name: "ステータス変更" })).toBeNull();
    expect(screen.getByText("操作不可")).toBeDefined();
  });

  it("複数ユーザーを正しく表示する", async () => {
    const user2 = {
      id: "user-2",
      name: "User Two",
      email: "user2@example.com",
      image: null,
      isBanned: false,
      createdAt: new Date("2026-04-01T00:00:00Z"),
      userRoles: [{ role: { name: "user" } }],
      registeredRoom: null,
    };
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    userFindManyMock.mockResolvedValue([dbUser, user2]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    expect(screen.getByRole("heading", { name: "ユーザー一覧 2件" })).toBeDefined();
    expect(screen.getByText("User One")).toBeDefined();
    expect(screen.getByText("User Two")).toBeDefined();
  });

  it("ルーム未登録ユーザーは「未登録」を表示する", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    userFindManyMock.mockResolvedValue([{ ...dbUser, registeredRoom: null }]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    expect(screen.getByText("未登録")).toBeDefined();
  });

  it("ルーム登録済みユーザーはルーム名を表示する", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    userFindManyMock.mockResolvedValue([
      { ...dbUser, registeredRoom: { roomId: "12345", roomUrl: "alpha-room", roomName: "Alpha Room" } },
    ]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-05-01T00:00:00.000Z");

    await renderPage();

    expect(screen.getByText("Alpha Room")).toBeDefined();
    expect(screen.queryByText("未登録")).toBeNull();
  });
});
