import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StopMaintenanceButton } from "./stop-maintenance-button";

const { routerRefreshMock, routerPushMock } = vi.hoisted(() => ({
  routerRefreshMock: vi.fn(),
  routerPushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
    push: routerPushMock,
  }),
}));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  routerRefreshMock.mockReset();
  routerPushMock.mockReset();
  fetchMock.mockReset();
});

describe("StopMaintenanceButton", () => {
  it("「メンテナンスを停止」ボタンが表示される", () => {
    render(<StopMaintenanceButton windowId="mw-1" />);

    expect(screen.getByRole("button", { name: /メンテナンスを停止/ })).not.toBeNull();
  });

  it("ボタンをクリックすると正しいエンドポイントへ PATCH リクエストが送信される", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    render(<StopMaintenanceButton windowId="mw-1" />);
    fireEvent.click(screen.getByRole("button", { name: /メンテナンスを停止/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/maintenance/mw-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ isEnabled: false }),
        }),
      );
    });
  });

  it("成功時に router.refresh() と router.push(\"/\") が呼ばれる", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    render(<StopMaintenanceButton windowId="mw-1" />);
    fireEvent.click(screen.getByRole("button", { name: /メンテナンスを停止/ }));

    await waitFor(() => {
      expect(routerRefreshMock).toHaveBeenCalledOnce();
      expect(routerPushMock).toHaveBeenCalledWith("/");
    });
  });

  it("API がエラーレスポンスを返した場合はエラーメッセージが表示される", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "権限がありません" }, { status: 403 }),
    );

    render(<StopMaintenanceButton windowId="mw-1" />);
    fireEvent.click(screen.getByRole("button", { name: /メンテナンスを停止/ }));

    expect(await screen.findByText("権限がありません")).not.toBeNull();
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("API のエラーレスポンスに error フィールドがない場合はデフォルトメッセージが表示される", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }));

    render(<StopMaintenanceButton windowId="mw-1" />);
    fireEvent.click(screen.getByRole("button", { name: /メンテナンスを停止/ }));

    expect(await screen.findByText("エラーが発生しました")).not.toBeNull();
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("通信エラーが発生した場合はエラーメッセージが表示される", async () => {
    fetchMock.mockRejectedValue(new Error("Network Error"));

    render(<StopMaintenanceButton windowId="mw-1" />);
    fireEvent.click(screen.getByRole("button", { name: /メンテナンスを停止/ }));

    expect(await screen.findByText("通信エラーが発生しました")).not.toBeNull();
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});
