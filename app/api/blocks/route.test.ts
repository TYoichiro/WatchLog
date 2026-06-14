import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  authzErrorResponse: vi.fn(),
  listUserBlocks: vi.fn(),
  createUserBlock: vi.fn(),
  serializeUserBlock: vi.fn(),
  blockedUserIdsCacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  DeveloperBlockForbiddenError: class DeveloperBlockForbiddenError extends Error {
    readonly status = 403;
    constructor() {
      super("Developer user cannot be blocked");
      this.name = "DeveloperBlockForbiddenError";
    }
  },
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
  listUserBlocks: mocks.listUserBlocks,
  createUserBlock: mocks.createUserBlock,
  serializeUserBlock: mocks.serializeUserBlock,
  blockedUserIdsCacheTag: mocks.blockedUserIdsCacheTag,
  DeveloperBlockForbiddenError: mocks.DeveloperBlockForbiddenError,
}));

const user = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  image: null,
};

const blockData = {
  id: "block-1",
  blockedUserId: "showroom-user-123",
  blockedUserName: "TestStreamer",
  createdAt: new Date("2026-06-14T00:00:00Z"),
  updatedAt: new Date("2026-06-14T00:00:00Z"),
};

const serializedBlock = {
  id: "block-1",
  blockedUserId: "showroom-user-123",
  blockedUserName: "TestStreamer",
  createdAt: "2026-06-14T09:00:00.000+09:00",
  updatedAt: "2026-06-14T09:00:00.000+09:00",
};

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(user);
  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.listUserBlocks.mockResolvedValue([blockData]);
  mocks.createUserBlock.mockResolvedValue(blockData);
  mocks.serializeUserBlock.mockReturnValue(serializedBlock);
  mocks.blockedUserIdsCacheTag.mockReturnValue("user-blocks-ids-user-1");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/blocks", () => {
  it("未認証の場合は 401 を返す", async () => {
    mocks.requireUser.mockRejectedValue(new Error("Unauthorized"));
    mocks.authzErrorResponse.mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("ブロックリストを返す", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.blocks).toHaveLength(1);
    expect(mocks.listUserBlocks).toHaveBeenCalledWith(user.id);
  });

  it("ブロックが 0 件の場合は空配列を返す", async () => {
    mocks.listUserBlocks.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.blocks).toHaveLength(0);
  });
});

describe("POST /api/blocks", () => {
  describe("リクエストボディのバリデーション", () => {
    it("不正な JSON の場合は 400 を返す（auth 確認前）", async () => {
      const request = new NextRequest("http://localhost/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mocks.requireUser).not.toHaveBeenCalled();
    });

    it("blockedUserId が欠けている場合は 400 を返す", async () => {
      const response = await POST(
        makePostRequest({ blockedUserName: "TestStreamer" })
      );

      expect(response.status).toBe(400);
      expect(mocks.requireUser).not.toHaveBeenCalled();
    });

    it("blockedUserName が欠けている場合は 400 を返す", async () => {
      const response = await POST(
        makePostRequest({ blockedUserId: "showroom-user-123" })
      );

      expect(response.status).toBe(400);
      expect(mocks.requireUser).not.toHaveBeenCalled();
    });

    it("空白のみの blockedUserId は 400 を返す", async () => {
      const response = await POST(
        makePostRequest({ blockedUserId: "   ", blockedUserName: "TestStreamer" })
      );

      expect(response.status).toBe(400);
    });
  });

  describe("認証", () => {
    it("未認証の場合は 401 を返す", async () => {
      mocks.requireUser.mockRejectedValue(new Error("Unauthorized"));
      mocks.authzErrorResponse.mockReturnValue(
        Response.json({ error: "Unauthorized" }, { status: 401 })
      );

      const response = await POST(
        makePostRequest({
          blockedUserId: "showroom-user-123",
          blockedUserName: "TestStreamer",
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe("開発者ブロック禁止", () => {
    it("DeveloperBlockForbiddenError の場合は 403 を返す", async () => {
      mocks.createUserBlock.mockRejectedValue(
        new mocks.DeveloperBlockForbiddenError()
      );

      const response = await POST(
        makePostRequest({
          blockedUserId: "showroom-user-123",
          blockedUserName: "TestStreamer",
        })
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("開発者はブロックできません");
    });
  });

  describe("正常なブロック作成", () => {
    it("200 とブロックデータを返す", async () => {
      const response = await POST(
        makePostRequest({
          blockedUserId: "showroom-user-123",
          blockedUserName: "TestStreamer",
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.block).toEqual(serializedBlock);
    });

    it("createUserBlock を正しい引数で呼び出す", async () => {
      await POST(
        makePostRequest({
          blockedUserId: "showroom-user-123",
          blockedUserName: "  TestStreamer  ",
        })
      );

      expect(mocks.createUserBlock).toHaveBeenCalledWith(user.id, {
        blockedUserId: "showroom-user-123",
        blockedUserName: "TestStreamer",
      });
    });

    it("キャッシュを revalidate する", async () => {
      await POST(
        makePostRequest({
          blockedUserId: "showroom-user-123",
          blockedUserName: "TestStreamer",
        })
      );

      expect(mocks.revalidateTag).toHaveBeenCalledWith(
        "user-blocks-ids-user-1",
        "default"
      );
    });
  });
});
