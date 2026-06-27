import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  authzErrorResponse: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  requirePermission: vi.fn(),
  userFindUnique: vi.fn(),
  roleFindUnique: vi.fn(),
  userRoleUpsert: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/authz", () => ({
  authzErrorResponse: mocks.authzErrorResponse,
  requirePermission: mocks.requirePermission,
  TOP_ADMIN_ROLE_NAME: "admin",
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
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
  return new Request("http://localhost/api/admin/users/user-1/roles", {
    method: "POST",
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
  mocks.writeAuditLog.mockResolvedValue({ id: "audit-1", createdAt: new Date() });
  mocks.userRoleUpsert.mockResolvedValue({ id: "user-role-1" });
  mocks.transaction.mockImplementation(
    async (
      callback: (tx: {
        user: { findUnique: typeof mocks.userFindUnique };
        role: { findUnique: typeof mocks.roleFindUnique };
        userRole: { upsert: typeof mocks.userRoleUpsert };
      }) => Promise<unknown>,
    ) =>
      callback({
        user: { findUnique: mocks.userFindUnique },
        role: { findUnique: mocks.roleFindUnique },
        userRole: { upsert: mocks.userRoleUpsert },
      }),
  );
  mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
  mocks.roleFindUnique.mockResolvedValue(premiumRole);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/users/[userId]/roles", () => {
  describe("ロール割り当て成功", () => {
    it("ロールを割り当てて 200 を返す", async () => {
      const response = await POST(makeRequest({ roleId: "role-premium" }), makeContext());

      expect(response.status).toBe(200);
      const body = await expectJson(response) as { userRole: Record<string, unknown> };
      expect(body.userRole).toBeDefined();
      expect(body.userRole.id).toBe("user-role-1");
    });

    it("レスポンスに role の id と name を含む", async () => {
      const response = await POST(makeRequest({ roleId: "role-premium" }), makeContext());
      const body = await expectJson(response) as { userRole: { role: Record<string, unknown> } };

      expect(body.userRole.role.id).toBe("role-premium");
      expect(body.userRole.role.name).toBe("premiumuser");
    });

    it("requirePermission に role.assign を渡す", async () => {
      await POST(makeRequest({ roleId: "role-premium" }), makeContext());

      expect(mocks.requirePermission).toHaveBeenCalledWith("role.assign");
    });

    it("userRole を upsert する", async () => {
      await POST(makeRequest({ roleId: "role-premium" }), makeContext("user-1"));

      expect(mocks.userRoleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_roleId: { userId: "user-1", roleId: "role-premium" } },
          create: expect.objectContaining({ userId: "user-1", roleId: "role-premium", assignedByUserId: "admin-1" }),
        }),
      );
    });

    it("role.assign のオーディットログを記録する", async () => {
      await POST(makeRequest({ roleId: "role-premium" }), makeContext("user-1"));

      expect(mocks.writeAuditLog).toHaveBeenCalledWith(
        {
          actorUserId: "admin-1",
          action: "role.assign",
          resource: "user",
          resourceId: "user-1",
          detail: {
            roleId: "role-premium",
            roleName: "premiumuser",
          },
        },
        expect.anything(),
      );
    });
  });

  describe("エラー処理", () => {
    it("roleId がないボディで 400 を返す", async () => {
      const response = await POST(makeRequest({ foo: "bar" }), makeContext());

      expect(response.status).toBe(400);
      expect(await expectJson(response)).toEqual({ error: "Invalid request body" });
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("roleId が空文字で 400 を返す", async () => {
      const response = await POST(makeRequest({ roleId: "" }), makeContext());

      expect(response.status).toBe(400);
      expect(await expectJson(response)).toEqual({ error: "Invalid request body" });
    });

    it("roleId が文字列でない場合は 400 を返す", async () => {
      const response = await POST(makeRequest({ roleId: 123 }), makeContext());

      expect(response.status).toBe(400);
      expect(await expectJson(response)).toEqual({ error: "Invalid request body" });
    });

    it("ボディが配列の場合は 400 を返す", async () => {
      const response = await POST(makeRequest([{ roleId: "role-premium" }]), makeContext());

      expect(response.status).toBe(400);
      expect(await expectJson(response)).toEqual({ error: "Invalid request body" });
    });

    it("JSON 不正で 400 を返す", async () => {
      const request = new Request("http://localhost/api/admin/users/user-1/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });

      const response = await POST(request, makeContext());

      expect(response.status).toBe(400);
    });

    it("対象ユーザーが存在しない場合は 404 を返す", async () => {
      mocks.userFindUnique.mockResolvedValue(null);

      const response = await POST(makeRequest({ roleId: "role-premium" }), makeContext());

      expect(response.status).toBe(404);
      expect(await expectJson(response)).toEqual({ error: "User not found" });
      expect(mocks.userRoleUpsert).not.toHaveBeenCalled();
    });

    it("ロールが存在しない場合は 404 を返す", async () => {
      mocks.roleFindUnique.mockResolvedValue(null);

      const response = await POST(makeRequest({ roleId: "role-unknown" }), makeContext());

      expect(response.status).toBe(404);
      expect(await expectJson(response)).toEqual({ error: "Role not found" });
      expect(mocks.userRoleUpsert).not.toHaveBeenCalled();
    });

    it("admin ロールを割り当てようとすると 403 を返す", async () => {
      mocks.roleFindUnique.mockResolvedValue({ id: "role-admin", name: "admin" });

      const response = await POST(makeRequest({ roleId: "role-admin" }), makeContext());

      expect(response.status).toBe(403);
      expect(await expectJson(response)).toEqual({
        error: "Admin role must be assigned directly in the database",
      });
      expect(mocks.userRoleUpsert).not.toHaveBeenCalled();
    });

    it("認可エラーをそのまま返す", async () => {
      const error = new Error("Unauthorized");
      const authzResponse = Response.json({ error: "Unauthorized" }, { status: 401 });
      mocks.requirePermission.mockRejectedValue(error);
      mocks.authzErrorResponse.mockReturnValue(authzResponse);

      const response = await POST(makeRequest({ roleId: "role-premium" }), makeContext());

      expect(response.status).toBe(401);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("トランザクション失敗時は 500 を返す", async () => {
      const error = new Error("database failed");
      mocks.transaction.mockRejectedValue(error);

      const response = await POST(makeRequest({ roleId: "role-premium" }), makeContext());

      expect(response.status).toBe(500);
      expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
      expect(mocks.loggerError).toHaveBeenCalledWith("ロールの割り当てに失敗しました", {
        error: "Error: database failed",
      });
    });
  });
});
