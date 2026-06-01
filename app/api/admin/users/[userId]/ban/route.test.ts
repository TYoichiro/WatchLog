import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  authzErrorResponse: vi.fn(),
  hasTopAdminRole: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  requireTopAdminRole: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/authz", () => ({
  authzErrorResponse: mocks.authzErrorResponse,
  hasTopAdminRole: mocks.hasTopAdminRole,
  requireTopAdminRole: mocks.requireTopAdminRole,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
    session: {
      deleteMany: mocks.sessionDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

const actor = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@example.com",
  image: null,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/users/user-1/ban", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext(userId = "user-1") {
  return { params: Promise.resolve({ userId }) };
}

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.hasTopAdminRole.mockResolvedValue(false);
  mocks.requireTopAdminRole.mockResolvedValue(actor);
  mocks.userFindUnique.mockResolvedValue({ id: "user-1", isBanned: false });
  mocks.writeAuditLog.mockResolvedValue({ id: "audit-1", createdAt: new Date() });
  mocks.transaction.mockImplementation(
    async (
      callback: (tx: {
        user: { update: typeof mocks.userUpdate };
        session: { deleteMany: typeof mocks.sessionDeleteMany };
      }) => Promise<unknown>,
    ) => callback({ user: { update: mocks.userUpdate }, session: { deleteMany: mocks.sessionDeleteMany } }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/users/[userId]/ban", () => {
  describe("BAN する", () => {
    it("BAN して 200 を返す", async () => {
      const response = await PATCH(makeRequest({ banned: true }), makeContext());

      expect(response.status).toBe(200);
      expect(await expectJson(response)).toEqual({ banned: true });
    });

    it("requireTopAdminRole を呼び出す", async () => {
      await PATCH(makeRequest({ banned: true }), makeContext());

      expect(mocks.requireTopAdminRole).toHaveBeenCalledOnce();
    });

    it("対象ユーザーの isBanned を true に更新する", async () => {
      await PATCH(makeRequest({ banned: true }), makeContext("user-1"));

      expect(mocks.userUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { isBanned: true },
      });
    });

    it("user.ban のオーディットログを記録する", async () => {
      await PATCH(makeRequest({ banned: true }), makeContext("user-1"));

      expect(mocks.writeAuditLog).toHaveBeenCalledWith(
        {
          actorUserId: "admin-1",
          action: "user.ban",
          resource: "user",
          resourceId: "user-1",
          detail: { banned: true },
        },
        expect.anything(),
      );
    });

    it("info ログを出力する", async () => {
      await PATCH(makeRequest({ banned: true }), makeContext("user-1"));

      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        "ユーザーのBAN状態を更新しました",
        { actorId: "admin-1", userId: "user-1", banned: true },
      );
    });

    it("BAN 時に対象ユーザーのセッションを削除する", async () => {
      await PATCH(makeRequest({ banned: true }), makeContext("user-1"));

      expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    });
  });

  describe("BAN を解除する", () => {
    beforeEach(() => {
      mocks.userFindUnique.mockResolvedValue({ id: "user-1", isBanned: true });
    });

    it("解除して 200 を返す", async () => {
      const response = await PATCH(makeRequest({ banned: false }), makeContext());

      expect(response.status).toBe(200);
      expect(await expectJson(response)).toEqual({ banned: false });
    });

    it("対象ユーザーの isBanned を false に更新する", async () => {
      await PATCH(makeRequest({ banned: false }), makeContext("user-1"));

      expect(mocks.userUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { isBanned: false, inviteCodeFailureCount: 0 },
      });
    });

    it("user.unban のオーディットログを記録する", async () => {
      await PATCH(makeRequest({ banned: false }), makeContext("user-1"));

      expect(mocks.writeAuditLog).toHaveBeenCalledWith(
        {
          actorUserId: "admin-1",
          action: "user.unban",
          resource: "user",
          resourceId: "user-1",
          detail: { banned: false },
        },
        expect.anything(),
      );
    });

    it("解除時はセッションを削除しない", async () => {
      await PATCH(makeRequest({ banned: false }), makeContext("user-1"));

      expect(mocks.sessionDeleteMany).not.toHaveBeenCalled();
    });
  });

  describe("エラー処理", () => {
    it("対象ユーザーが存在しない場合は 404 を返す", async () => {
      mocks.userFindUnique.mockResolvedValue(null);

      const response = await PATCH(makeRequest({ banned: true }), makeContext());

      expect(response.status).toBe(404);
      expect(await expectJson(response)).toEqual({ error: "User not found" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("自分自身を BAN しようとすると 400 を返す", async () => {
      mocks.userFindUnique.mockResolvedValue({ id: "admin-1", isBanned: false });

      const response = await PATCH(makeRequest({ banned: true }), makeContext("admin-1"));

      expect(response.status).toBe(400);
      expect(await expectJson(response)).toEqual({ error: "Cannot ban yourself" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("管理者を BAN しようとすると 403 を返す", async () => {
      mocks.hasTopAdminRole.mockResolvedValue(true);

      const response = await PATCH(makeRequest({ banned: true }), makeContext("other-admin"));

      expect(response.status).toBe(403);
      expect(await expectJson(response)).toEqual({ error: "Cannot ban an admin" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("不正なボディ（banned フィールドなし）で 400 を返す", async () => {
      const response = await PATCH(makeRequest({ foo: true }), makeContext());

      expect(response.status).toBe(400);
      expect(await expectJson(response)).toEqual({ error: "Invalid request body" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("不正なボディ（banned が boolean でない）で 400 を返す", async () => {
      const response = await PATCH(makeRequest({ banned: "yes" }), makeContext());

      expect(response.status).toBe(400);
      expect(await expectJson(response)).toEqual({ error: "Invalid request body" });
    });

    it("JSON 不正で 400 を返す", async () => {
      const request = new Request("http://localhost/api/admin/users/user-1/ban", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });

      const response = await PATCH(request, makeContext());

      expect(response.status).toBe(400);
    });

    it("認可エラーをそのまま返す", async () => {
      const error = new Error("Forbidden");
      const authzResponse = Response.json({ error: "Forbidden" }, { status: 403 });
      mocks.requireTopAdminRole.mockRejectedValue(error);
      mocks.authzErrorResponse.mockReturnValue(authzResponse);

      const response = await PATCH(makeRequest({ banned: true }), makeContext());

      expect(response.status).toBe(403);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("トランザクション失敗時は 500 を返す", async () => {
      const error = new Error("database failed");
      mocks.transaction.mockRejectedValue(error);

      const response = await PATCH(makeRequest({ banned: true }), makeContext());

      expect(response.status).toBe(500);
      expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
      expect(mocks.loggerError).toHaveBeenCalledWith("ユーザーのBAN状態更新に失敗しました", {
        error: "Error: database failed",
      });
    });
  });
});
