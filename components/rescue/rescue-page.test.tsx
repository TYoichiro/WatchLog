"use client";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RescuePage } from "./rescue-page";

const KEY_PREFIX = "watchlog:onlive:";

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    roomId: 12345,
    liveId: "live-abc",
    comments: [] as unknown[],
    gifts: [] as unknown[],
    metrics: null,
    savedAt: 1767225600000, // 2026-01-01T00:00:00 UTC = 2026-01-01T09:00:00 JST
    ...overrides,
  };
}

function setEntry(keySuffix: string, value: unknown) {
  localStorage.setItem(KEY_PREFIX + keySuffix, JSON.stringify(value));
}

const okResponse = () =>
  new Response(JSON.stringify({ ok: true }), { status: 200 });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("RescuePage", () => {
  describe("空の状態", () => {
    it("ローカルストレージが空のとき空状態メッセージを表示する", () => {
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });

    it("空の状態では「復旧する」ボタンを表示しない", () => {
      render(<RescuePage />);
      expect(screen.queryByRole("button", { name: "復旧する" })).toBeNull();
    });

    it("空の状態では「ダウンロード」ボタンを表示しない", () => {
      render(<RescuePage />);
      expect(screen.queryByRole("button", { name: "ダウンロード" })).toBeNull();
    });
  });

  describe("isValidSnapshot — 不正エントリの除外", () => {
    it("有効なスナップショットが1件ある場合、件数を表示する", () => {
      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      expect(screen.getByText("1件のログが見つかりました")).toBeDefined();
    });

    it("version が 1 以外のエントリは無視される", () => {
      setEntry("invalid", makeSnapshot({ version: 2 }));
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });

    it("roomId が文字列のエントリは無視される", () => {
      setEntry("invalid", makeSnapshot({ roomId: "12345" }));
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });

    it("liveId が空文字のエントリは無視される", () => {
      setEntry("invalid", makeSnapshot({ liveId: "" }));
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });

    it("liveId がスペースのみのエントリは無視される", () => {
      setEntry("invalid", makeSnapshot({ liveId: "   " }));
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });

    it("comments が配列でないエントリは無視される", () => {
      setEntry("invalid", makeSnapshot({ comments: "not-array" }));
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });

    it("gifts が null のエントリは無視される", () => {
      setEntry("invalid", makeSnapshot({ gifts: null }));
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });

    it("savedAt が文字列のエントリは無視される", () => {
      setEntry("invalid", makeSnapshot({ savedAt: "2026-01-01" }));
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });

    it("JSON として解析できないエントリは無視される", () => {
      localStorage.setItem(KEY_PREFIX + "broken", "not-json{{{");
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });

    it("プレフィックスが異なるキーは無視される", () => {
      localStorage.setItem("other:key", JSON.stringify(makeSnapshot()));
      render(<RescuePage />);
      expect(
        screen.getByText("ローカルストレージにログが見つかりませんでした")
      ).toBeDefined();
    });
  });

  describe("エントリの表示", () => {
    it("ルームIDを表示する", () => {
      setEntry("room-1", makeSnapshot({ roomId: 99999 }));
      render(<RescuePage />);
      expect(screen.getByText("99999")).toBeDefined();
    });

    it("ライブIDを表示する", () => {
      setEntry("room-1", makeSnapshot({ liveId: "live-xyz" }));
      render(<RescuePage />);
      expect(screen.getByText("live-xyz")).toBeDefined();
    });

    it("コメント数を表示する", () => {
      setEntry("room-1", makeSnapshot({ comments: [{}, {}, {}] }));
      render(<RescuePage />);
      expect(screen.getByText("3件")).toBeDefined();
    });

    it("ギフト数を表示する", () => {
      setEntry("room-1", makeSnapshot({ gifts: [{}, {}] }));
      render(<RescuePage />);
      expect(screen.getAllByText("2件").length).toBeGreaterThan(0);
    });

    it("savedAt を JST 表示形式でフォーマットする (2026-01-01T09:00:00 JST)", () => {
      // 1767225600000 = 2026-01-01T00:00:00 UTC = 2026-01-01T09:00:00 JST
      setEntry("room-1", makeSnapshot({ savedAt: 1767225600000 }));
      render(<RescuePage />);
      expect(screen.getByText("2026/01/01 09:00:00")).toBeDefined();
    });

    it("複数のエントリをすべて表示する", () => {
      setEntry("room-1", makeSnapshot({ roomId: 11111, liveId: "live-1" }));
      setEntry("room-2", makeSnapshot({ roomId: 22222, liveId: "live-2" }));
      render(<RescuePage />);
      expect(screen.getByText("2件のログが見つかりました")).toBeDefined();
      expect(screen.getByText("11111")).toBeDefined();
      expect(screen.getByText("22222")).toBeDefined();
    });

    it("アイドル状態のエントリがある場合「復旧する」ボタンと「ダウンロード」ボタンを表示する", () => {
      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      expect(screen.getByRole("button", { name: "復旧する" })).toBeDefined();
      expect(screen.getByRole("button", { name: "ダウンロード" })).toBeDefined();
    });
  });

  describe("復旧ボタン", () => {
    it("/api/onlive/logs に POST する", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", fetchMock);

      setEntry("room-1", makeSnapshot({ roomId: 12345, liveId: "live-abc" }));
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/onlive/logs",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          })
        );
      });
    });

    it("POST ボディに roomId を文字列で、liveId と capturedAt を含む", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", fetchMock);

      setEntry("room-1", makeSnapshot({ roomId: 12345, liveId: "live-abc", savedAt: 1767225600000 }));
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(init.body as string);
        expect(body.roomId).toBe("12345");
        expect(body.liveId).toBe("live-abc");
        expect(body.capturedAt).toBe(1767225600000);
      });
    });

    it("POST ボディの log.source が 'rescue' である", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", fetchMock);

      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(init.body as string);
        expect(body.log.source).toBe("rescue");
      });
    });

    it("POST ボディの log.capturedAt は JST Wall Time 文字列である", async () => {
      const fetchMock = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", fetchMock);

      // 1767225600000 = 2026-01-01T00:00:00 UTC = 2026-01-01T09:00:00+09:00
      setEntry("room-1", makeSnapshot({ savedAt: 1767225600000 }));
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(init.body as string);
        expect(body.log.capturedAt).toBe("2026-01-01T09:00:00.000+09:00");
      });
    });

    it("成功後に「保存しました」を表示する", async () => {
      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        expect(screen.getByText("保存しました")).toBeDefined();
      });
    });

    it("成功後にローカルストレージからキーを削除する", async () => {
      setEntry("room-1", makeSnapshot());
      expect(localStorage.getItem(KEY_PREFIX + "room-1")).not.toBeNull();

      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        expect(localStorage.getItem(KEY_PREFIX + "room-1")).toBeNull();
      });
    });

    it("すべてのエントリが成功後「復旧する」ボタンが消える", async () => {
      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        expect(screen.getByText("保存しました")).toBeDefined();
      });
      expect(screen.queryByRole("button", { name: "復旧する" })).toBeNull();
    });

    it("API が 4xx を返した場合にエラーメッセージを表示する", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
        )
      );

      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        expect(screen.getByText("エラー: Forbidden")).toBeDefined();
      });
    });

    it("API エラーに error フィールドがない場合はステータスコードを表示する", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response("Internal Server Error", { status: 500 })
        )
      );

      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        expect(screen.getByText("エラー: エラー (500)")).toBeDefined();
      });
    });

    it("API エラー後はローカルストレージのキーを保持する", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
        )
      );

      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        expect(screen.getByText("エラー: Forbidden")).toBeDefined();
      });
      expect(localStorage.getItem(KEY_PREFIX + "room-1")).not.toBeNull();
    });

    it("複数エントリがある場合、各エントリを個別に処理する", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(okResponse())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
        );
      vi.stubGlobal("fetch", fetchMock);

      setEntry("room-1", makeSnapshot({ roomId: 11111, liveId: "live-1" }));
      setEntry("room-2", makeSnapshot({ roomId: 22222, liveId: "live-2" }));
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "復旧する" }));

      await waitFor(() => {
        expect(screen.getByText("保存しました")).toBeDefined();
        expect(screen.getByText(/エラー:/)).toBeDefined();
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("ダウンロードボタン", () => {
    it("「ダウンロード」をクリックすると URL.createObjectURL を呼ぶ", () => {
      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "ダウンロード" }));
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it("「ダウンロード」をクリックすると URL.revokeObjectURL を呼ぶ", () => {
      setEntry("room-1", makeSnapshot());
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "ダウンロード" }));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    });

    it("複数エントリがある場合、エントリ数分 createObjectURL を呼ぶ", () => {
      setEntry("room-1", makeSnapshot({ roomId: 11111, liveId: "live-1" }));
      setEntry("room-2", makeSnapshot({ roomId: 22222, liveId: "live-2" }));
      render(<RescuePage />);
      fireEvent.click(screen.getByRole("button", { name: "ダウンロード" }));
      expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    });
  });
});
