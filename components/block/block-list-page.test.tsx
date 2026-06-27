import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BlockListPage } from "./block-list-page";

type BlockItem = {
  id: string;
  blockedUserId: string;
  blockedUserName: string;
  createdAt: string;
  updatedAt: string;
};

function makeBlock(overrides: Partial<BlockItem> = {}): BlockItem {
  return {
    id: "block-1",
    blockedUserId: "user-123",
    blockedUserName: "テストユーザー",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function blocksOkResponse(blocks: BlockItem[]) {
  return new Response(JSON.stringify({ blocks }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("BlockListPage", () => {
  describe("ローディング状態", () => {
    it("初期ローディング中はエラーメッセージを表示しない", () => {
      fetchMock.mockReturnValue(new Promise(() => {}));
      render(<BlockListPage roomId="room-1" />);
      expect(screen.queryByText("ブロック一覧を取得できませんでした。")).toBeNull();
    });

    it("初期ローディング中は空状態メッセージを表示しない", () => {
      fetchMock.mockReturnValue(new Promise(() => {}));
      render(<BlockListPage roomId="room-1" />);
      expect(screen.queryByText("ブロック中のユーザーはいません。")).toBeNull();
    });
  });

  describe("エラー状態", () => {
    it("API エラーの場合エラーメッセージを表示する", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
      );
      render(<BlockListPage roomId="room-1" />);
      expect(await screen.findByText("ブロック一覧を取得できませんでした。")).toBeDefined();
    });

    it("ネットワークエラーの場合エラーメッセージを表示する", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));
      render(<BlockListPage roomId="room-1" />);
      expect(await screen.findByText("ブロック一覧を取得できませんでした。")).toBeDefined();
    });
  });

  describe("空の状態", () => {
    it("ブロックがない場合に空状態メッセージを表示する", async () => {
      fetchMock.mockResolvedValueOnce(blocksOkResponse([]));
      render(<BlockListPage roomId="room-1" />);
      expect(await screen.findByText("ブロック中のユーザーはいません。")).toBeDefined();
    });
  });

  describe("データ表示", () => {
    it("ブロック件数を表示する", async () => {
      fetchMock.mockResolvedValueOnce(blocksOkResponse([makeBlock()]));
      render(<BlockListPage roomId="room-1" />);
      expect(await screen.findByText("1件")).toBeDefined();
    });

    it("ブロックされたユーザーIDを表示する", async () => {
      fetchMock.mockResolvedValueOnce(blocksOkResponse([makeBlock({ blockedUserId: "user-999" })]));
      render(<BlockListPage roomId="room-1" />);
      expect(await screen.findByText("user-999")).toBeDefined();
    });

    it("ブロックされたユーザー名を表示する", async () => {
      fetchMock.mockResolvedValueOnce(blocksOkResponse([makeBlock({ blockedUserName: "サンプルユーザー" })]));
      render(<BlockListPage roomId="room-1" />);
      expect(await screen.findByText("サンプルユーザー")).toBeDefined();
    });

    it("createdAt を JST フォーマットで表示する (UTC → JST 変換)", async () => {
      // 2026-01-01T00:00:00.000Z = 2026-01-01T09:00:00 JST
      fetchMock.mockResolvedValueOnce(
        blocksOkResponse([makeBlock({ createdAt: "2026-01-01T00:00:00.000Z" })])
      );
      render(<BlockListPage roomId="room-1" />);
      expect(await screen.findByText("2026/01/01 09:00:00")).toBeDefined();
    });

    it("無効な createdAt のとき '--' を表示する", async () => {
      fetchMock.mockResolvedValueOnce(
        blocksOkResponse([makeBlock({ createdAt: "invalid-date" })])
      );
      render(<BlockListPage roomId="room-1" />);
      expect(await screen.findByText("--")).toBeDefined();
    });

    it("複数ブロックを全て表示する", async () => {
      fetchMock.mockResolvedValueOnce(
        blocksOkResponse([
          makeBlock({ id: "b1", blockedUserName: "ユーザーA" }),
          makeBlock({ id: "b2", blockedUserId: "user-456", blockedUserName: "ユーザーB" }),
        ])
      );
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("ユーザーA");
      expect(screen.getByText("ユーザーB")).toBeDefined();
      expect(screen.getByText("2件")).toBeDefined();
    });
  });

  describe("削除確認ダイアログ", () => {
    it("削除ボタンをクリックすると確認ダイアログが開く", async () => {
      fetchMock.mockResolvedValueOnce(blocksOkResponse([makeBlock()]));
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      expect(screen.getByRole("alertdialog")).toBeDefined();
    });

    it("ダイアログにユーザー名が表示される", async () => {
      fetchMock.mockResolvedValueOnce(
        blocksOkResponse([makeBlock({ blockedUserName: "対象ユーザー" })])
      );
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("対象ユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      expect(screen.getByText("対象ユーザー のブロックを解除します。")).toBeDefined();
    });

    it("「いいえ」をクリックするとダイアログが閉じる", async () => {
      fetchMock.mockResolvedValueOnce(blocksOkResponse([makeBlock()]));
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(screen.getByRole("button", { name: "いいえ" }));
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
      });
    });

    it("「はい」をクリックすると DELETE API を呼び出す", async () => {
      fetchMock
        .mockResolvedValueOnce(blocksOkResponse([makeBlock({ id: "block-42" })]))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(screen.getByRole("button", { name: "はい" }));
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/blocks/block-42",
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    it("削除成功後にブロックが一覧から消える", async () => {
      fetchMock
        .mockResolvedValueOnce(blocksOkResponse([makeBlock()]))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(screen.getByRole("button", { name: "はい" }));
      await waitFor(() => {
        expect(screen.queryByText("テストユーザー")).toBeNull();
      });
    });

    it("削除成功後にダイアログが閉じる", async () => {
      fetchMock
        .mockResolvedValueOnce(blocksOkResponse([makeBlock()]))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(screen.getByRole("button", { name: "はい" }));
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
      });
    });

    it("削除 API エラーの場合ダイアログ内にエラーメッセージを表示する", async () => {
      fetchMock
        .mockResolvedValueOnce(blocksOkResponse([makeBlock()]))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
        );
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(screen.getByRole("button", { name: "はい" }));
      expect(await screen.findByText("Forbidden")).toBeDefined();
    });

    it("削除エラー後もブロックは一覧に残る", async () => {
      fetchMock
        .mockResolvedValueOnce(blocksOkResponse([makeBlock()]))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
        );
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(screen.getByRole("button", { name: "はい" }));
      await screen.findByText("Forbidden");
      expect(screen.getByText("テストユーザー")).toBeDefined();
    });

    it("削除中は「はい」ボタンが無効化される", async () => {
      let resolveDelete!: () => void;
      fetchMock
        .mockResolvedValueOnce(blocksOkResponse([makeBlock()]))
        .mockReturnValueOnce(
          new Promise<Response>((resolve) => {
            resolveDelete = () => resolve(new Response(null, { status: 200 }));
          })
        );
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(screen.getByRole("button", { name: "はい" }));

      await waitFor(() => {
        expect((screen.getByRole("button", { name: /はい/ }) as HTMLButtonElement).disabled).toBe(true);
      });

      resolveDelete();

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
      });
    });

    it("削除中は「いいえ」ボタンが無効化される", async () => {
      fetchMock
        .mockResolvedValueOnce(blocksOkResponse([makeBlock()]))
        .mockReturnValueOnce(new Promise(() => {}));
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(screen.getByRole("button", { name: "はい" }));

      await waitFor(() => {
        expect((screen.getByRole("button", { name: "いいえ" }) as HTMLButtonElement).disabled).toBe(true);
      });
    });
  });

  describe("ユーザー名クリック", () => {
    it("ユーザー名をクリックするとプロフィールダイアログが開く", async () => {
      fetchMock
        .mockResolvedValueOnce(
          blocksOkResponse([makeBlock({ blockedUserId: "user-123", blockedUserName: "テストユーザー" })])
        )
        .mockResolvedValue(
          new Response(JSON.stringify({ profile: null }), { status: 200 })
        );
      render(<BlockListPage roomId="room-1" />);
      await screen.findByText("テストユーザー");
      fireEvent.click(screen.getByRole("button", { name: "テストユーザー" }));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeDefined();
      });
    });
  });
});
