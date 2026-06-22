import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MaintenancePage from "./page";

const {
  authMock,
  getActiveMaintenanceWindowMock,
  hasTopAdminRoleMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getActiveMaintenanceWindowMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
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

vi.mock("@/lib/maintenance", () => ({
  getActiveMaintenanceWindow: getActiveMaintenanceWindowMock,
}));

vi.mock("@/components/maintenance/stop-maintenance-button", () => ({
  StopMaintenanceButton: ({ windowId }: { windowId: string }) => (
    <button type="button" data-window-id={windowId}>
      メンテナンスを停止
    </button>
  ),
}));

const baseMaintenanceWindow = {
  id: "mw-1",
  title: "定期メンテナンス",
  message: "サーバーのアップデートを行います。",
  startsAt: new Date("2026-06-22T01:00:00+09:00"),
  endsAt: new Date("2026-06-22T03:00:00+09:00"),
  period: "2026/06/22（月）01:00〜2026/06/22（月）03:00",
};

afterEach(() => {
  cleanup();
  authMock.mockReset();
  getActiveMaintenanceWindowMock.mockReset();
  hasTopAdminRoleMock.mockReset();
  redirectMock.mockClear();
});

describe("MaintenancePage", () => {
  it("メンテナンスウィンドウがない場合は / へリダイレクトする", async () => {
    getActiveMaintenanceWindowMock.mockResolvedValue(null);

    await expect(MaintenancePage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("メンテナンスタイトルと期間が表示される", async () => {
    getActiveMaintenanceWindowMock.mockResolvedValue(baseMaintenanceWindow);
    authMock.mockResolvedValue(null);

    render(await MaintenancePage());

    expect(screen.getByRole("heading", { name: "定期メンテナンス" })).not.toBeNull();
    expect(
      screen.getByText("2026/06/22（月）01:00〜2026/06/22（月）03:00 までメンテナンス中です。"),
    ).not.toBeNull();
  });

  it("カスタムメッセージが表示される", async () => {
    getActiveMaintenanceWindowMock.mockResolvedValue(baseMaintenanceWindow);
    authMock.mockResolvedValue(null);

    render(await MaintenancePage());

    expect(screen.getByText("サーバーのアップデートを行います。")).not.toBeNull();
  });

  it("メッセージが null の場合はデフォルトメッセージが表示される", async () => {
    getActiveMaintenanceWindowMock.mockResolvedValue({
      ...baseMaintenanceWindow,
      message: null,
    });
    authMock.mockResolvedValue(null);

    render(await MaintenancePage());

    expect(
      screen.getByText(
        "ただいまシステムメンテナンスを実施しています。終了後に再度アクセスしてください。",
      ),
    ).not.toBeNull();
  });

  it("管理者ユーザーにはメンテナンス停止ボタンが表示される", async () => {
    getActiveMaintenanceWindowMock.mockResolvedValue(baseMaintenanceWindow);
    authMock.mockResolvedValue({ user: { id: "admin-user-1" } });
    hasTopAdminRoleMock.mockResolvedValue(true);

    render(await MaintenancePage());

    const stopButton = screen.getByRole("button", { name: "メンテナンスを停止" });
    expect(stopButton).not.toBeNull();
    expect(stopButton.getAttribute("data-window-id")).toBe("mw-1");
  });

  it("非管理者ユーザーにはメンテナンス停止ボタンが表示されない", async () => {
    getActiveMaintenanceWindowMock.mockResolvedValue(baseMaintenanceWindow);
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    hasTopAdminRoleMock.mockResolvedValue(false);

    render(await MaintenancePage());

    expect(screen.queryByRole("button", { name: "メンテナンスを停止" })).toBeNull();
  });

  it("未ログインの場合はメンテナンス停止ボタンが表示されず管理者チェックもしない", async () => {
    getActiveMaintenanceWindowMock.mockResolvedValue(baseMaintenanceWindow);
    authMock.mockResolvedValue(null);

    render(await MaintenancePage());

    expect(screen.queryByRole("button", { name: "メンテナンスを停止" })).toBeNull();
    expect(hasTopAdminRoleMock).not.toHaveBeenCalled();
  });
});
