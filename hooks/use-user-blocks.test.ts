import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUserBlocks } from "./use-user-blocks";
import type { UserBlockListItem } from "./use-user-blocks";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}

const mockBlock1: UserBlockListItem = {
  id: "block-1",
  blockedUserId: "user-1",
  blockedUserName: "User One",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockBlock2: UserBlockListItem = {
  id: "block-2",
  blockedUserId: "user-2",
  blockedUserName: "User Two",
  createdAt: "2024-01-02T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("useUserBlocks", () => {
  describe("初期ロード", () => {
    it("マウント直後は isLoading=true, hasError=false, blocks=[]", () => {
      fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));

      const { result } = renderHook(() => useUserBlocks());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasError).toBe(false);
      expect(result.current.blocks).toEqual([]);
    });

    it("ブロックリスト取得成功時にリストがセットされる", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ blocks: [mockBlock1, mockBlock2] }),
      );

      const { result } = renderHook(() => useUserBlocks());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.blocks).toEqual([mockBlock1, mockBlock2]);
      expect(result.current.hasError).toBe(false);
    });

    it("ブロックリスト取得失敗時に hasError=true になる", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: "Unauthorized" }, { status: 401 }),
      );

      const { result } = renderHook(() => useUserBlocks());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasError).toBe(true);
      expect(result.current.blocks).toEqual([]);
    });

    it("blocks フィールドが配列でない場合は空配列になる", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ blocks: null }));

      const { result } = renderHook(() => useUserBlocks());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.blocks).toEqual([]);
    });

    it("初期フェッチは /api/blocks に no-store で行われる", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ blocks: [] }));

      renderHook(() => useUserBlocks());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/blocks",
          expect.objectContaining({ cache: "no-store" }),
        );
      });
    });

    it("アンマウント時に AbortError が発生しても hasError にならない", async () => {
      fetchMock.mockImplementation(async (_: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal;
        if (signal) {
          await new Promise<void>((_, reject) => {
            signal.addEventListener("abort", () => {
              reject(
                Object.assign(new Error("AbortError"), { name: "AbortError" }),
              );
            });
          });
        }
        return new Response();
      });

      const { result, unmount } = renderHook(() => useUserBlocks());
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        unmount();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.hasError).toBe(false);
    });
  });

  describe("blockedUserIds", () => {
    it("blocks から blockedUserId の Set が生成される", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ blocks: [mockBlock1, mockBlock2] }),
      );

      const { result } = renderHook(() => useUserBlocks());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.blockedUserIds).toEqual(new Set(["user-1", "user-2"]));
    });

    it("ブロックがない場合は空の Set が返る", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ blocks: [] }));

      const { result } = renderHook(() => useUserBlocks());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.blockedUserIds.size).toBe(0);
    });

    it("ブロック追加後に blockedUserIds が更新される", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [mockBlock1] }))
        .mockResolvedValueOnce(jsonResponse({ block: mockBlock2 }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.blockUser("user-2", "User Two");
      });

      expect(result.current.blockedUserIds).toEqual(new Set(["user-1", "user-2"]));
    });
  });

  describe("blockUser", () => {
    it("ブロック成功時にリストの先頭に追加される", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [mockBlock1] }))
        .mockResolvedValueOnce(jsonResponse({ block: mockBlock2 }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.blockUser("user-2", "User Two");
      });

      expect(result.current.blocks[0]).toEqual(mockBlock2);
      expect(result.current.blocks[1]).toEqual(mockBlock1);
    });

    it("同じ blockedUserId のブロックは既存エントリを置き換える", async () => {
      const updatedBlock: UserBlockListItem = {
        ...mockBlock1,
        updatedAt: "2024-06-01T00:00:00Z",
      };

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [mockBlock1] }))
        .mockResolvedValueOnce(jsonResponse({ block: updatedBlock }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.blockUser("user-1", "User One");
      });

      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.blocks[0]).toEqual(updatedBlock);
    });

    it("ブロック成功時に block オブジェクトを返す", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [] }))
        .mockResolvedValueOnce(jsonResponse({ block: mockBlock1 }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let returned: UserBlockListItem | undefined;
      await act(async () => {
        returned = await result.current.blockUser("user-1", "User One");
      });

      expect(returned).toEqual(mockBlock1);
    });

    it("ブロック失敗時にエラーレスポンスのメッセージで Error をスローする", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [] }))
        .mockResolvedValueOnce(
          jsonResponse({ error: "forbidden" }, { status: 403 }),
        );

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(result.current.blockUser("user-1", "User One")).rejects.toThrow(
        "forbidden",
      );
    });

    it("ブロック失敗でエラーボディが JSON でないときデフォルトメッセージが使われる", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [] }))
        .mockResolvedValueOnce(new Response("internal error", { status: 500 }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(result.current.blockUser("user-1", "User One")).rejects.toThrow(
        "ブロック操作に失敗しました",
      );
    });

    it("ブロック失敗でエラーフィールドがないときデフォルトメッセージが使われる", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [] }))
        .mockResolvedValueOnce(jsonResponse({}, { status: 500 }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(result.current.blockUser("user-1", "User One")).rejects.toThrow(
        "ブロック操作に失敗しました",
      );
    });

    it("POST /api/blocks に正しい JSON ボディが送られる", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [] }))
        .mockResolvedValueOnce(jsonResponse({ block: mockBlock1 }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.blockUser("user-1", "User One");
      });

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/blocks",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockedUserId: "user-1", blockedUserName: "User One" }),
          cache: "no-store",
        }),
      );
    });
  });

  describe("deleteBlock", () => {
    it("削除成功時にブロックリストから取り除かれる", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [mockBlock1, mockBlock2] }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteBlock("block-1");
      });

      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.blocks[0]).toEqual(mockBlock2);
    });

    it("削除失敗時にエラーレスポンスのメッセージで Error をスローする", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [mockBlock1] }))
        .mockResolvedValueOnce(
          jsonResponse({ error: "not found" }, { status: 404 }),
        );

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(result.current.deleteBlock("block-1")).rejects.toThrow(
        "not found",
      );
    });

    it("削除失敗時にブロックリストは変更されない", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [mockBlock1] }))
        .mockResolvedValueOnce(
          jsonResponse({ error: "error" }, { status: 500 }),
        );

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.deleteBlock("block-1");
        } catch {
          // expected
        }
      });

      expect(result.current.blocks).toEqual([mockBlock1]);
    });

    it("DELETE /api/blocks/:id の正しい URL で呼ばれる", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [mockBlock1] }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteBlock("block-1");
      });

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/blocks/block-1",
        expect.objectContaining({ method: "DELETE", cache: "no-store" }),
      );
    });

    it("blockId に特殊文字が含まれる場合 URL エンコードされる", async () => {
      const specialId = "block/special?id=1";

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [] }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteBlock(specialId);
      });

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        `/api/blocks/${encodeURIComponent(specialId)}`,
        expect.any(Object),
      );
    });
  });

  describe("refreshBlocks", () => {
    it("refreshBlocks を呼ぶとブロックリストが再取得される", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [mockBlock1] }))
        .mockResolvedValueOnce(jsonResponse({ blocks: [mockBlock1, mockBlock2] }));

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.blocks).toHaveLength(1);

      await act(async () => {
        await result.current.refreshBlocks();
      });

      expect(result.current.blocks).toHaveLength(2);
      expect(result.current.blocks).toEqual([mockBlock1, mockBlock2]);
    });

    it("refreshBlocks 失敗時に Error をスローする", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ blocks: [] }))
        .mockResolvedValueOnce(
          jsonResponse({ error: "server error" }, { status: 500 }),
        );

      const { result } = renderHook(() => useUserBlocks());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(result.current.refreshBlocks()).rejects.toThrow("server error");
    });
  });
});
