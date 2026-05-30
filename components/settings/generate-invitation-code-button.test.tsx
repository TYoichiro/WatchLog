import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GenerateInvitationCodeButton } from "./generate-invitation-code-button";

const { routerRefresh } = vi.hoisted(() => ({
  routerRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefresh,
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
  fetchMock.mockReset();
  routerRefresh.mockReset();
});

describe("GenerateInvitationCodeButton", () => {
  it("「招待コード生成」ボタンを表示する", () => {
    render(<GenerateInvitationCodeButton />);
    expect(screen.getByRole("button", { name: /招待コード生成/ })).toBeDefined();
  });

  it("POST /api/invitations を呼び出し成功後に router.refresh を実行する", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    render(<GenerateInvitationCodeButton />);
    fireEvent.click(screen.getByRole("button", { name: /招待コード生成/ }));

    await waitFor(() => {
      expect(routerRefresh).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/invitations",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.queryByText(/失敗/)).toBeNull();
  });

  it("APIエラー時にエラーメッセージを表示する", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, { status: 403 }));

    render(<GenerateInvitationCodeButton />);
    fireEvent.click(screen.getByRole("button", { name: /招待コード生成/ }));

    expect(await screen.findByText("招待コードの生成に失敗しました")).toBeDefined();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("ネットワークエラー時にエラーメッセージを表示する", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    render(<GenerateInvitationCodeButton />);
    fireEvent.click(screen.getByRole("button", { name: /招待コード生成/ }));

    expect(await screen.findByText("Network error")).toBeDefined();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("リクエスト中はボタンが無効化される", async () => {
    let resolveRequest!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<GenerateInvitationCodeButton />);
    const button = screen.getByRole("button", { name: /招待コード生成/ });

    fireEvent.click(button);

    expect((button as HTMLButtonElement).disabled).toBe(true);

    resolveRequest(jsonResponse({ ok: true }));

    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("APIエラー後にボタンが再び有効化される", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, { status: 403 }));

    render(<GenerateInvitationCodeButton />);
    const button = screen.getByRole("button", { name: /招待コード生成/ });

    fireEvent.click(button);

    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.getByText("招待コードの生成に失敗しました")).toBeDefined();
  });

  it("エラー発生後に再クリックして成功するとエラーメッセージが消える", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, { status: 403 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    render(<GenerateInvitationCodeButton />);
    const button = screen.getByRole("button", { name: /招待コード生成/ });

    fireEvent.click(button);
    expect(await screen.findByText("招待コードの生成に失敗しました")).toBeDefined();

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.queryByText("招待コードの生成に失敗しました")).toBeNull();
    });
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("Error以外がスローされた場合にデフォルトエラーメッセージを表示する", async () => {
    fetchMock.mockRejectedValueOnce("unexpected string error");

    render(<GenerateInvitationCodeButton />);
    fireEvent.click(screen.getByRole("button", { name: /招待コード生成/ }));

    expect(await screen.findByText("招待コードの生成に失敗しました")).toBeDefined();
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
