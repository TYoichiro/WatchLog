import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MaintenancePage } from "./maintenance-page";
import { NoticesPage } from "./notices-page";

const timestamps = {
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const pages = [
  {
    name: "NoticesPage",
    renderPage: () => render(<NoticesPage initialNotices={[{
      ...timestamps,
      id: 1,
      title: "対象のお知らせ",
      content: "本文",
      displayTarget: "ALL",
      publishedAt: "2026-01-01T00:00:00Z",
      expiresAt: null,
      linkUrl: null,
    }]} />),
  },
  {
    name: "MaintenancePage",
    renderPage: () => render(<MaintenancePage initialWindows={[{
      ...timestamps,
      id: "window-1",
      title: "対象のメンテナンス",
      message: null,
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2026-01-02T00:00:00Z",
      isEnabled: true,
    }]} />),
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each(pages)("$name loading feedback", ({ renderPage }) => {
  it("keeps the save dialog visible while pending, prevents duplicate requests, and recovers on failure", async () => {
    let rejectRequest!: (reason: Error) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise((_, reject) => {
      rejectRequest = reject;
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    fireEvent.click(screen.getByLabelText("編集"));
    const form = screen.getByLabelText(/タイトル/).closest("form")!;
    fireEvent.submit(form);

    const saving = screen.getByRole("button", { name: "保存中..." }) as HTMLButtonElement;
    expect(saving.disabled).toBe(true);
    expect(saving.getAttribute("aria-busy")).toBe("true");
    expect(saving.querySelector(".animate-spin")).not.toBeNull();
    fireEvent.submit(form);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => rejectRequest(new Error("offline")));
    expect(screen.getByText("通信エラーが発生しました")).toBeDefined();
    expect((screen.getByRole("button", { name: "更新" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps deletion progress visible until the response and allows retry after an API failure", async () => {
    let resolveRequest!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValueOnce(new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    fireEvent.click(screen.getByLabelText("削除"));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "削除" }));

    const deleting = screen.getByRole("button", { name: "削除中..." }) as HTMLButtonElement;
    expect(deleting.disabled).toBe(true);
    expect(deleting.getAttribute("aria-busy")).toBe("true");
    expect(deleting.querySelector(".animate-spin")).not.toBeNull();
    fireEvent.click(deleting);
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => resolveRequest(new Response(JSON.stringify({ error: "削除できませんでした" }), { status: 503 })));
    expect(screen.getByRole("alert").textContent).toBe("削除できませんでした");
    const retry = within(screen.getByRole("alertdialog")).getByRole("button", { name: "削除" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByText("0件")).toBeDefined();
  });
});
