import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireTopAdminRole: vi.fn(),
  authzErrorResponse: vi.fn(),
  addInvitationCode: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireTopAdminRole: mocks.requireTopAdminRole,
  authzErrorResponse: mocks.authzErrorResponse,
}));

vi.mock("@/lib/invitations", () => ({
  addInvitationCode: mocks.addInvitationCode,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}));

const adminUser = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@example.com",
  image: null,
};

const invitation = {
  id: "inv-1",
  code: "ABCD123456",
  createdById: "admin-1",
  usedById: null,
  usedAt: null,
  createdAt: new Date("2026-06-27T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTopAdminRole.mockResolvedValue(adminUser);
  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.addInvitationCode.mockResolvedValue(invitation);
});

describe("POST /api/invitations", () => {
  describe("認証・認可", () => {
    it("未認証の場合は 401 を返す", async () => {
      mocks.requireTopAdminRole.mockRejectedValue(new Error("Unauthorized"));
      mocks.authzErrorResponse.mockReturnValue(
        Response.json({ error: "Unauthorized" }, { status: 401 })
      );

      const response = await POST();

      expect(response.status).toBe(401);
    });

    it("権限不足の場合は 403 を返す", async () => {
      mocks.requireTopAdminRole.mockRejectedValue(new Error("Forbidden"));
      mocks.authzErrorResponse.mockReturnValue(
        Response.json({ error: "Forbidden" }, { status: 403 })
      );

      const response = await POST();

      expect(response.status).toBe(403);
    });
  });

  describe("招待コード作成", () => {
    it("201 と招待コードデータを返す", async () => {
      const response = await POST();

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject({
        id: invitation.id,
        code: invitation.code,
        createdById: invitation.createdById,
        usedById: invitation.usedById,
        usedAt: invitation.usedAt,
      });
    });

    it("addInvitationCode をユーザー ID で呼び出す", async () => {
      await POST();

      expect(mocks.addInvitationCode).toHaveBeenCalledWith(adminUser.id);
    });

    it("成功時に info ログを出力する", async () => {
      await POST();

      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        "招待コードが作成されました",
        expect.objectContaining({
          actorId: adminUser.id,
          invitationCode: invitation.code,
        })
      );
    });
  });
});
