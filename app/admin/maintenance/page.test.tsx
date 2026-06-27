import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminMaintenancePage from "./page";

const {
  authMock,
  hasTopAdminRoleMock,
  listAllMaintenanceWindowsMock,
  redirectMock,
  toJstWallTimeIsoStringMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
  listAllMaintenanceWindowsMock: vi.fn(),
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

vi.mock("@/lib/maintenance", () => ({
  listAllMaintenanceWindows: listAllMaintenanceWindowsMock,
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

vi.mock("@/components/admin/maintenance-page", () => ({
  MaintenancePage: ({ initialWindows }: { initialWindows: unknown[] }) => (
    <div data-testid="maintenance-page" data-count={initialWindows.length}>
      メンテナンス設定 {initialWindows.length}件
    </div>
  ),
}));

const session = { user: { id: "admin-1" } };

const makeWindow = (overrides = {}) => ({
  id: "win-1",
  title: "システムメンテナンス",
  message: null,
  startsAt: new Date("2026-06-22T01:00:00.000Z"),
  endsAt: new Date("2026-06-22T03:00:00.000Z"),
  isEnabled: true,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  ...overrides,
});

afterEach(() => {
  cleanup();
  authMock.mockReset();
  hasTopAdminRoleMock.mockReset();
  listAllMaintenanceWindowsMock.mockReset();
  redirectMock.mockClear();
  toJstWallTimeIsoStringMock.mockReset();
});

describe("AdminMaintenancePage", () => {
  it("未認証の場合は / へリダイレクトする", async () => {
    authMock.mockResolvedValue(null);

    await expect(AdminMaintenancePage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(hasTopAdminRoleMock).not.toHaveBeenCalled();
    expect(listAllMaintenanceWindowsMock).not.toHaveBeenCalled();
  });

  it("管理者でない場合は /dashboard へリダイレクトする", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(false);

    await expect(AdminMaintenancePage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(hasTopAdminRoleMock).toHaveBeenCalledWith("admin-1");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(listAllMaintenanceWindowsMock).not.toHaveBeenCalled();
  });

  it("管理者の場合はメンテナンス設定ページを表示する", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllMaintenanceWindowsMock.mockResolvedValue([makeWindow()]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-06-22T10:00:00.000+09:00");

    render(await AdminMaintenancePage());

    expect(screen.getByTestId("maintenance-page")).toBeDefined();
  });

  it("AppShell に activeKey='admin-maintenance' と isAdmin=true が渡される", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllMaintenanceWindowsMock.mockResolvedValue([]);

    render(await AdminMaintenancePage());

    const shell = screen.getByTestId("app-shell");
    expect(shell.getAttribute("data-active-key")).toBe("admin-maintenance");
    expect(shell.getAttribute("data-is-admin")).toBe("true");
  });

  it("メンテナンスウィンドウ一覧が MaintenancePage に渡される", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllMaintenanceWindowsMock.mockResolvedValue([makeWindow(), makeWindow({ id: "win-2" })]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-06-22T10:00:00.000+09:00");

    render(await AdminMaintenancePage());

    const maintenancePage = screen.getByTestId("maintenance-page");
    expect(maintenancePage.getAttribute("data-count")).toBe("2");
  });

  it("メンテナンスウィンドウが空のとき空リストで MaintenancePage が表示される", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllMaintenanceWindowsMock.mockResolvedValue([]);

    render(await AdminMaintenancePage());

    const maintenancePage = screen.getByTestId("maintenance-page");
    expect(maintenancePage.getAttribute("data-count")).toBe("0");
  });

  it("各ウィンドウの日時フィールドを toJstWallTimeIsoString で変換する", async () => {
    const window = makeWindow();
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllMaintenanceWindowsMock.mockResolvedValue([window]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-06-22T10:00:00.000+09:00");

    render(await AdminMaintenancePage());

    expect(toJstWallTimeIsoStringMock).toHaveBeenCalledWith(window.startsAt);
    expect(toJstWallTimeIsoStringMock).toHaveBeenCalledWith(window.endsAt);
    expect(toJstWallTimeIsoStringMock).toHaveBeenCalledWith(window.createdAt);
    expect(toJstWallTimeIsoStringMock).toHaveBeenCalledWith(window.updatedAt);
  });

  it("listAllMaintenanceWindows が呼ばれる", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllMaintenanceWindowsMock.mockResolvedValue([]);

    render(await AdminMaintenancePage());

    expect(listAllMaintenanceWindowsMock).toHaveBeenCalledTimes(1);
  });

  it("hasTopAdminRole が userId で呼ばれる", async () => {
    authMock.mockResolvedValue({ user: { id: "specific-user" } });
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllMaintenanceWindowsMock.mockResolvedValue([]);

    render(await AdminMaintenancePage());

    expect(hasTopAdminRoleMock).toHaveBeenCalledWith("specific-user");
  });

  it("message が null のウィンドウも正しくマッピングされる", async () => {
    const window = makeWindow({ message: null });
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllMaintenanceWindowsMock.mockResolvedValue([window]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-06-22T10:00:00.000+09:00");

    render(await AdminMaintenancePage());

    expect(screen.getByTestId("maintenance-page")).toBeDefined();
  });

  it("message が文字列のウィンドウも正しくマッピングされる", async () => {
    const window = makeWindow({ message: "メンテナンス内容の説明" });
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    listAllMaintenanceWindowsMock.mockResolvedValue([window]);
    toJstWallTimeIsoStringMock.mockReturnValue("2026-06-22T10:00:00.000+09:00");

    render(await AdminMaintenancePage());

    expect(screen.getByTestId("maintenance-page")).toBeDefined();
  });
});
