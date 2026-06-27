import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "./route";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  authzErrorResponse: vi.fn(),
  getUserRoles: vi.fn(),
  toggleOnliveLogFavorite: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: mocks.requireUser,
  authzErrorResponse: mocks.authzErrorResponse,
  getUserRoles: mocks.getUserRoles,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/onlive-log", () => ({
  toggleOnliveLogFavorite: mocks.toggleOnliveLogFavorite,
}));

const user = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  image: null,
};

function makeContext(logId = "log-1") {
  return { params: Promise.resolve({ logId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(user);
  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: true });
  mocks.toggleOnliveLogFavorite.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PUT /api/onlive/logs/[logId]/favorite", () => {
  describe("バリデーション", () => {
    it("空白のみの logId は 400 を返す", async () => {
      const response = await PUT(
        new Request("http://localhost/api/onlive/logs/   /favorite", { method: "PUT" }),
        makeContext("   ")
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("logId is required");
    });
  });

  describe("認証", () => {
    it("未認証の場合は 401 を返す", async () => {
      mocks.requireUser.mockRejectedValue(new Error("Unauthorized"));
      mocks.authzErrorResponse.mockReturnValue(
        Response.json({ error: "Unauthorized" }, { status: 401 })
      );

      const response = await PUT(
        new Request("http://localhost/api/onlive/logs/log-1/favorite", { method: "PUT" }),
        makeContext()
      );

      expect(response.status).toBe(401);
    });
  });

  describe("認可", () => {
    it("プレミアムでも管理者でもない場合は 403 を返す", async () => {
      mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: false });

      const response = await PUT(
        new Request("http://localhost/api/onlive/logs/log-1/favorite", { method: "PUT" }),
        makeContext()
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Forbidden");
      expect(mocks.toggleOnliveLogFavorite).not.toHaveBeenCalled();
    });

    it("プレミアムユーザーはお気に入りを切り替えられる", async () => {
      mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: true });

      const response = await PUT(
        new Request("http://localhost/api/onlive/logs/log-1/favorite", { method: "PUT" }),
        makeContext()
      );

      expect(response.status).toBe(200);
    });

    it("管理者はお気に入りを切り替えられる", async () => {
      mocks.getUserRoles.mockResolvedValue({ isAdmin: true, isPremium: false });

      const response = await PUT(
        new Request("http://localhost/api/onlive/logs/log-1/favorite", { method: "PUT" }),
        makeContext()
      );

      expect(response.status).toBe(200);
    });
  });

  describe("お気に入り切り替え", () => {
    it("toggleOnliveLogFavorite を正しい引数で呼び出す（プレミアムユーザー）", async () => {
      mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: true });

      await PUT(
        new Request("http://localhost/api/onlive/logs/log-1/favorite", { method: "PUT" }),
        makeContext()
      );

      expect(mocks.toggleOnliveLogFavorite).toHaveBeenCalledWith(user.id, "log-1", false);
    });

    it("toggleOnliveLogFavorite を正しい引数で呼び出す（管理者）", async () => {
      mocks.getUserRoles.mockResolvedValue({ isAdmin: true, isPremium: false });

      await PUT(
        new Request("http://localhost/api/onlive/logs/log-1/favorite", { method: "PUT" }),
        makeContext()
      );

      expect(mocks.toggleOnliveLogFavorite).toHaveBeenCalledWith(user.id, "log-1", true);
    });

    it("ok: true と isFavorite: true を返す", async () => {
      mocks.toggleOnliveLogFavorite.mockResolvedValue(true);

      const response = await PUT(
        new Request("http://localhost/api/onlive/logs/log-1/favorite", { method: "PUT" }),
        makeContext()
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ ok: true, isFavorite: true });
    });

    it("ok: true と isFavorite: false を返す", async () => {
      mocks.toggleOnliveLogFavorite.mockResolvedValue(false);

      const response = await PUT(
        new Request("http://localhost/api/onlive/logs/log-1/favorite", { method: "PUT" }),
        makeContext()
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ ok: true, isFavorite: false });
    });

    it("予期しないエラーの場合は 500 を返す", async () => {
      mocks.toggleOnliveLogFavorite.mockRejectedValue(new Error("DB error"));

      const response = await PUT(
        new Request("http://localhost/api/onlive/logs/log-1/favorite", { method: "PUT" }),
        makeContext()
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Failed to toggle favorite");
    });
  });
});
