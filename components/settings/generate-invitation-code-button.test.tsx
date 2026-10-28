import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense, useState } from "react";
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
  it("API 成功後もページ更新が完了するまでローディングを維持する", async () => {
    let finishRefresh!: () => void;
    let refreshComplete = false;
    const refreshPromise = new Promise<void>((resolve) => {
      finishRefresh = () => {
        refreshComplete = true;
        resolve();
      };
    });
    function UpdatedContent({ refreshing }: { refreshing: boolean }) {
      if (refreshing && !refreshComplete) throw refreshPromise;
      return <p>{refreshing ? "更新されたコード" : "現在のコード"}</p>;
    }
    function Settings() {
      const [refreshing, setRefreshing] = useState(false);
      routerRefresh.mockImplementation(() => setRefreshing(true));
      return (
        <Suspense fallback={<p>ページ更新中</p>}>
          <GenerateInvitationCodeButton />
          <UpdatedContent refreshing={refreshing} />
        </Suspense>
      );
    }
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: "招待コード生成" }));

    await waitFor(() => expect(routerRefresh).toHaveBeenCalledTimes(1));
    const button = screen.getByRole("button", { name: "生成中..." }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => finishRefresh());
    expect(screen.getByText("更新されたコード")).toBeDefined();
    expect((screen.getByRole("button", { name: "招待コード生成" }) as HTMLButtonElement).disabled).toBe(false);
  });

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
    expect(button.textContent).toBe("生成中...");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.querySelector(".animate-spin")).not.toBeNull();
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);

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
