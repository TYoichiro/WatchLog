import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  authzErrorResponse: vi.fn(),
  deleteUserBlock: vi.fn(),
  blockedUserIdsCacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/authz", () => ({
  requireUser: mocks.requireUser,
  authzErrorResponse: mocks.authzErrorResponse,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/user-blocks", () => ({
  deleteUserBlock: mocks.deleteUserBlock,
  blockedUserIdsCacheTag: mocks.blockedUserIdsCacheTag,
}));

const user = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  image: null,
};

function makeContext(blockId = "block-1") {
  return { params: Promise.resolve({ blockId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(user);
  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.deleteUserBlock.mockResolvedValue(true);
  mocks.blockedUserIdsCacheTag.mockReturnValue("user-blocks-ids-user-1");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/blocks/[blockId]", () => {
  describe("バリデーション", () => {
    it("空白のみの blockId は 400 を返す", async () => {
      const response = await DELETE(
        new Request("http://localhost/api/blocks/   ", { method: "DELETE" }),
        makeContext("   ")
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("blockId is required");
    });
  });

  describe("認証", () => {
    it("未認証の場合は 401 を返す", async () => {
      mocks.requireUser.mockRejectedValue(new Error("Unauthorized"));
      mocks.authzErrorResponse.mockReturnValue(
        Response.json({ error: "Unauthorized" }, { status: 401 })
      );

      const response = await DELETE(
        new Request("http://localhost/api/blocks/block-1", { method: "DELETE" }),
        makeContext()
      );

      expect(response.status).toBe(401);
    });
  });

  describe("ブロック削除", () => {
    it("ブロックが存在しない場合は 404 を返す", async () => {
      mocks.deleteUserBlock.mockResolvedValue(false);

      const response = await DELETE(
        new Request("http://localhost/api/blocks/block-1", { method: "DELETE" }),
        makeContext()
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Block not found");
    });

    it("削除成功時は ok: true を返す", async () => {
      const response = await DELETE(
        new Request("http://localhost/api/blocks/block-1", { method: "DELETE" }),
        makeContext()
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ ok: true });
    });

    it("deleteUserBlock を正しい引数で呼び出す", async () => {
      await DELETE(
        new Request("http://localhost/api/blocks/block-1", { method: "DELETE" }),
        makeContext()
      );

      expect(mocks.deleteUserBlock).toHaveBeenCalledWith(user.id, "block-1");
    });

    it("削除成功時にキャッシュを revalidate する", async () => {
      await DELETE(
        new Request("http://localhost/api/blocks/block-1", { method: "DELETE" }),
        makeContext()
      );

      expect(mocks.revalidateTag).toHaveBeenCalledWith(
        "user-blocks-ids-user-1",
        "default"
      );
    });

    it("ブロックが存在しない場合は warn ログを出力する", async () => {
      mocks.deleteUserBlock.mockResolvedValue(false);

      await DELETE(
        new Request("http://localhost/api/blocks/block-1", { method: "DELETE" }),
        makeContext()
      );

      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "ブロック削除: 見つからないかユーザーが所有していません",
        expect.objectContaining({ userId: user.id, blockId: "block-1" })
      );
    });

    it("予期しないエラーの場合は 500 を返す", async () => {
      mocks.deleteUserBlock.mockRejectedValue(new Error("DB error"));

      const response = await DELETE(
        new Request("http://localhost/api/blocks/block-1", { method: "DELETE" }),
        makeContext()
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Failed to delete block");
    });
  });
});
