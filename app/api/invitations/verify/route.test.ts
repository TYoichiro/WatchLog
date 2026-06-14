import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isInvitationCodeAvailable: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
  txUserUpdate: vi.fn(),
  txSessionDeleteMany: vi.fn(),
  writeAuditLog: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/invitations", () => ({
  isInvitationCodeAvailable: mocks.isInvitationCodeAvailable,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: mocks.loggerWarn },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: mocks.userUpdate },
    $transaction: mocks.transaction,
  },
}));

const userId = "user-1";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/invitations/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type BanTx = {
  user: { update: typeof mocks.txUserUpdate };
  session: { deleteMany: typeof mocks.txSessionDeleteMany };
};

function makeBanTx(): BanTx {
  return {
    user: { update: mocks.txUserUpdate },
    session: { deleteMany: mocks.txSessionDeleteMany },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: userId } });
  mocks.isInvitationCodeAvailable.mockResolvedValue(true);
  mocks.userUpdate.mockResolvedValue({ inviteCodeFailureCount: 0 });
  mocks.writeAuditLog.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(
    async (callback: (tx: BanTx) => Promise<unknown>) => callback(makeBanTx())
  );
});

describe("POST /api/invitations/verify", () => {
  describe("認証", () => {
    it("未認証の場合は 401 を返す", async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await POST(makeRequest({ inviteCode: "ABCD123456" }));

      expect(response.status).toBe(401);
    });
  });

  describe("リクエストボディ", () => {
    it("不正な JSON の場合は 400 を返す", async () => {
      const request = new NextRequest("http://localhost/api/invitations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe("有効なコード", () => {
    it("valid: true を返す", async () => {
      mocks.isInvitationCodeAvailable.mockResolvedValue(true);

      const response = await POST(makeRequest({ inviteCode: "ABCD123456" }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ valid: true });
    });

    it("失敗カウントを 0 にリセットする", async () => {
      mocks.isInvitationCodeAvailable.mockResolvedValue(true);

      await POST(makeRequest({ inviteCode: "ABCD123456" }));

      expect(mocks.userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: { inviteCodeFailureCount: 0 },
        })
      );
    });
  });

  describe("無効なコード（BANに至らない場合）", () => {
    it("valid: false と remainingAttempts を返す", async () => {
      mocks.isInvitationCodeAvailable.mockResolvedValue(false);
      mocks.userUpdate.mockResolvedValue({ inviteCodeFailureCount: 1 });

      const response = await POST(makeRequest({ inviteCode: "BADCODE123" }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.valid).toBe(false);
      expect(body.remainingAttempts).toBe(2);
    });

    it("失敗カウントをインクリメントする", async () => {
      mocks.isInvitationCodeAvailable.mockResolvedValue(false);
      mocks.userUpdate.mockResolvedValue({ inviteCodeFailureCount: 2 });

      await POST(makeRequest({ inviteCode: "BADCODE123" }));

      expect(mocks.userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: { inviteCodeFailureCount: { increment: 1 } },
        })
      );
    });
  });

  describe("BANしきい値到達", () => {
    beforeEach(() => {
      mocks.isInvitationCodeAvailable.mockResolvedValue(false);
      mocks.userUpdate.mockResolvedValue({ inviteCodeFailureCount: 3 });
    });

    it("banned: true を返す", async () => {
      const response = await POST(makeRequest({ inviteCode: "BADCODE123" }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ valid: false, banned: true });
    });

    it("ユーザーを BAN してセッションを削除するトランザクションを実行する", async () => {
      await POST(makeRequest({ inviteCode: "BADCODE123" }));

      expect(mocks.transaction).toHaveBeenCalledTimes(1);
      expect(mocks.txUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: { isBanned: true },
        })
      );
      expect(mocks.txSessionDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId } })
      );
    });

    it("BAN の監査ログを記録する", async () => {
      await POST(makeRequest({ inviteCode: "BADCODE123" }));

      expect(mocks.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: null,
          action: "user.ban",
          resource: "user",
          resourceId: userId,
          detail: expect.objectContaining({ reason: "invite_code_failure" }),
        }),
        expect.anything()
      );
    });

    it("warn ログを出力する", async () => {
      await POST(makeRequest({ inviteCode: "BADCODE123" }));

      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "招待コード失敗により自動BANされました",
        expect.objectContaining({ userId, failureCount: 3 })
      );
    });
  });
});
