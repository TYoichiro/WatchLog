import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  authzErrorResponse: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  requirePermission: vi.fn(),
  userFindUnique: vi.fn(),
  roleFindUnique: vi.fn(),
  userRoleUpsert: vi.fn(),
  userRoleDeleteMany: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/authz", () => ({
  authzErrorResponse: mocks.authzErrorResponse,
  requirePermission: mocks.requirePermission,
  PREMIUM_ROLE_NAME: "premiumuser",
  TOP_ADMIN_ROLE_NAME: "admin",
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction,
  },
}));

const actor = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@example.com",
  image: null,
};

const premiumRole = { id: "role-premium", name: "premiumuser" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/users/user-1/role", {
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
  mocks.requirePermission.mockResolvedValue(actor);
  mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
  mocks.writeAuditLog.mockResolvedValue({ id: "audit-1", createdAt: new Date() });
  mocks.roleFindUnique.mockResolvedValue(premiumRole);
  mocks.userRoleUpsert.mockResolvedValue({ id: "user-role-1" });
  mocks.userRoleDeleteMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(
    async (
      callback: (tx: {
        role: { findUnique: typeof mocks.roleFindUnique };
        userRole: {
          upsert: typeof mocks.userRoleUpsert;
          deleteMany: typeof mocks.userRoleDeleteMany;
        };
      }) => Promise<unknown>,
    ) =>
      callback({
        role: { findUnique: mocks.roleFindUnique },
        userRole: {
          upsert: mocks.userRoleUpsert,
          deleteMany: mocks.userRoleDeleteMany,
        },
      }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/users/[userId]/role", () => {
  describe("premiumuser への昇格", () => {
    it("プレミアムロールを付与して 200 を返す", async () => {
      const response = await PATCH(makeRequest({ role: "premiumuser" }), makeContext());

      expect(response.status).toBe(200);
      expect(await expectJson(response)).toEqual({ role: "premiumuser" });
    });

    it("requirePermission に role.assign を渡す", async () => {
      await PATCH(makeRequest({ role: "premiumuser" }), makeContext());

      expect(mocks.requirePermission).toHaveBeenCalledWith("role.assign");
    });

    it("premiumuser ロールを upsert する", async () => {
      await PATCH(makeRequest({ role: "premiumuser" }), makeContext("user-1"));

      expect(mocks.userRoleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_roleId: { userId: "user-1", roleId: "role-premium" } },
          create: expect.objectContaining({ userId: "user-1", roleId: "role-premium", assignedByUserId: "admin-1" }),
        }),
      );
    });

    it("role.assign のオーディットログを記録する", async () => {
      await PATCH(makeRequest({ role: "premiumuser" }), makeContext("user-1"));

      expect(mocks.writeAuditLog).toHaveBeenCalledWith(
        {
          actorUserId: "admin-1",
          action: "role.assign",
          resource: "user",
          resourceId: "user-1",
          detail: { roleName: "premiumuser" },
        },
        expect.anything(),
      );
    });

    it("info ログを出力する", async () => {
      await PATCH(makeRequest({ role: "premiumuser" }), makeContext("user-1"));

      expect(mocks.loggerInfo).toHaveBeenCalledWith("ロールをプレミアムに設定しました", {
        actorId: "admin-1",
        userId: "user-1",
      });
    });
  });

  describe("general への降格", () => {
    it("プレミアムロールを削除して 200 を返す", async () => {
      const response = await PATCH(makeRequest({ role: "general" }), makeContext());

      expect(response.status).toBe(200);
      expect(await expectJson(response)).toEqual({ role: "general" });
    });

    it("premiumuser ロールを deleteMany する", async () => {
      await PATCH(makeRequest({ role: "general" }), makeContext("user-1"));

      expect(mocks.userRoleDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-1", roleId: "role-premium" }),
        }),
      );
    });

    it("ロールが存在した場合は role.remove オーディットログを記録する", async () => {
      mocks.userRoleDeleteMany.mockResolvedValue({ count: 1 });

      await PATCH(makeRequest({ role: "general" }), makeContext("user-1"));

      expect(mocks.writeAuditLog).toHaveBeenCalledWith(
        {
          actorUserId: "admin-1",
          action: "role.remove",
          resource: "user",
          resourceId: "user-1",
          detail: { roleName: "premiumuser" },
        },
        expect.anything(),
      );
    });

    it("ロールが存在しなかった場合はオーディットログを記録しない", async () => {
      mocks.userRoleDeleteMany.mockResolvedValue({ count: 0 });

      await PATCH(makeRequest({ role: "general" }), makeContext("user-1"));

      expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    });

    it("info ログを出力する", async () => {
      await PATCH(makeRequest({ role: "general" }), makeContext("user-1"));

      expect(mocks.loggerInfo).toHaveBeenCalledWith("ロールを一般に設定しました", {
        actorId: "admin-1",
        userId: "user-1",
      });
    });
  });

  describe("エラー処理", () => {
    it("対象ユーザーが存在しない場合は 404 を返す", async () => {
      mocks.userFindUnique.mockResolvedValue(null);

      const response = await PATCH(makeRequest({ role: "premiumuser" }), makeContext());

      expect(response.status).toBe(404);
      expect(await expectJson(response)).toEqual({ error: "User not found" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("不正なボディ（role フィールドなし）で 400 を返す", async () => {
      const response = await PATCH(makeRequest({ foo: "bar" }), makeContext());

      expect(response.status).toBe(400);
      expect(await expectJson(response)).toEqual({ error: "Invalid request body" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("不正なボディ（不正な role 値）で 400 を返す", async () => {
      const response = await PATCH(makeRequest({ role: "admin" }), makeContext());

      expect(response.status).toBe(400);
      expect(await expectJson(response)).toEqual({ error: "Invalid request body" });
    });

    it("JSON 不正で 400 を返す", async () => {
      const request = new Request("http://localhost/api/admin/users/user-1/role", {
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
      mocks.requirePermission.mockRejectedValue(error);
      mocks.authzErrorResponse.mockReturnValue(authzResponse);

      const response = await PATCH(makeRequest({ role: "premiumuser" }), makeContext());

      expect(response.status).toBe(403);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("premiumuser ロールが DB に存在しない場合（昇格）は 500 を返す", async () => {
      mocks.roleFindUnique.mockResolvedValue(null);

      const response = await PATCH(makeRequest({ role: "premiumuser" }), makeContext());

      expect(response.status).toBe(500);
      expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
      expect(mocks.loggerError).toHaveBeenCalledWith("ロールの更新に失敗しました", expect.anything());
    });

    it("premiumuser ロールが DB に存在しない場合（降格）は 500 を返す", async () => {
      mocks.roleFindUnique.mockResolvedValue(null);

      const response = await PATCH(makeRequest({ role: "general" }), makeContext());

      expect(response.status).toBe(500);
      expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
      expect(mocks.loggerError).toHaveBeenCalledWith("ロールの更新に失敗しました", expect.anything());
    });

    it("トランザクション失敗時は 500 を返す", async () => {
      const error = new Error("database failed");
      mocks.transaction.mockRejectedValue(error);

      const response = await PATCH(makeRequest({ role: "premiumuser" }), makeContext());

      expect(response.status).toBe(500);
      expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
      expect(mocks.loggerError).toHaveBeenCalledWith("ロールの更新に失敗しました", {
        error: "Error: database failed",
      });
    });
  });
});
