import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, PUT } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTopAdminRole: vi.fn(),
  consumeInvitationCode: vi.fn(),
  ensureUserInvitationCodes: vi.fn(),
  getUserRegisteredRoom: vi.fn(),
  getRegisteredRoomOwner: vi.fn(),
  saveUserRegisteredRoom: vi.fn(),
  writeAuditLog: vi.fn(),
  transaction: vi.fn(),
  txUserRoleFindFirst: vi.fn(),
  txRoleFindUnique: vi.fn(),
  txUserRoleUpsert: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerDebug: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/authz", () => ({
  hasTopAdminRole: mocks.hasTopAdminRole,
  PREMIUM_ROLE_NAME: "premiumuser",
  TOP_ADMIN_ROLE_NAME: "admin",
}));

vi.mock("@/lib/invitations", () => ({
  consumeInvitationCode: mocks.consumeInvitationCode,
  ensureUserInvitationCodes: mocks.ensureUserInvitationCodes,
  InvalidInvitationCodeError: class InvalidInvitationCodeError extends Error {
    readonly status = 422;
    constructor(message = "招待コードが無効です。") {
      super(message);
      this.name = "InvalidInvitationCodeError";
    }
  },
}));

vi.mock("@/lib/user-registered-room", () => ({
  getUserRegisteredRoom: mocks.getUserRegisteredRoom,
  getRegisteredRoomOwner: mocks.getRegisteredRoomOwner,
  saveUserRegisteredRoom: mocks.saveUserRegisteredRoom,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    debug: mocks.loggerDebug,
  },
}));

const userId = "user-1";
const adminUserId = "admin-1";
const otherUserId = "other-user-1";

const registeredRoom = {
  roomId: "room-123",
  roomName: "Test Room",
  roomUrl: "test-room",
  imageUrl: null,
};

const premiumRole = { id: "role-premium" };

type Tx = {
  userRole: {
    findFirst: typeof mocks.txUserRoleFindFirst;
    upsert: typeof mocks.txUserRoleUpsert;
  };
  role: {
    findUnique: typeof mocks.txRoleFindUnique;
  };
};

function makeTx(): Tx {
  return {
    userRole: {
      findFirst: mocks.txUserRoleFindFirst,
      upsert: mocks.txUserRoleUpsert,
    },
    role: {
      findUnique: mocks.txRoleFindUnique,
    },
  };
}

function makePutRequest(body: unknown = {}): NextRequest {
  return new NextRequest("http://localhost/api/registered-room", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody() {
  return {
    roomId: "room-123",
    roomUrl: "https://showroom-live.com/room/test-room",
    inviteCode: "ABCD123456",
    roomName: "Test Room",
  };
}

async function parseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.auth.mockResolvedValue({ user: { id: userId } });
  mocks.hasTopAdminRole.mockResolvedValue(false);
  mocks.getUserRegisteredRoom.mockResolvedValue(null);
  mocks.getRegisteredRoomOwner.mockResolvedValue(null);
  mocks.saveUserRegisteredRoom.mockResolvedValue(registeredRoom);
  mocks.consumeInvitationCode.mockResolvedValue({
    code: "ABCD123456",
    id: "invite-code-1",
    inviterUserId: adminUserId,
  });
  mocks.ensureUserInvitationCodes.mockResolvedValue(undefined);
  mocks.writeAuditLog.mockResolvedValue(undefined);
  mocks.txUserRoleFindFirst.mockResolvedValue({ id: "user-role-admin" });
  mocks.txRoleFindUnique.mockResolvedValue(premiumRole);
  mocks.txUserRoleUpsert.mockResolvedValue({ id: "user-role-premium" });
  mocks.transaction.mockImplementation(
    async (callback: (tx: Tx) => Promise<unknown>) => callback(makeTx()),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/registered-room", () => {
  it("未認証の場合は 401 を返す", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("登録済みルームを返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await parseJson(response)).toEqual({ room: registeredRoom });
    expect(mocks.getUserRegisteredRoom).toHaveBeenCalledWith(userId);
  });

  it("ルーム未登録の場合は room: null を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await parseJson(response)).toEqual({ room: null });
  });
});

describe("PUT /api/registered-room", () => {
  describe("認証", () => {
    it("未認証の場合は 401 を返す", async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await PUT(makePutRequest(validBody()));

      expect(response.status).toBe(401);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("リクエストボディのバリデーション", () => {
    it("不正な JSON の場合は 400 を返す", async () => {
      const request = new NextRequest("http://localhost/api/registered-room", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it("roomId が欠けている場合は 400 を返す", async () => {
      const response = await PUT(
        makePutRequest({ roomUrl: "test-room", inviteCode: "ABCD123456" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("roomUrl が欠けている場合は 400 を返す", async () => {
      const response = await PUT(
        makePutRequest({ roomId: "123", inviteCode: "ABCD123456" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("inviteCode が欠けている場合は 400 を返す", async () => {
      const response = await PUT(
        makePutRequest({ roomId: "123", roomUrl: "test-room" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("重複チェック", () => {
    it("ユーザーが既にルームを登録済みの場合は 409 を返す", async () => {
      mocks.getUserRegisteredRoom.mockResolvedValue(registeredRoom);

      const response = await PUT(makePutRequest(validBody()));

      expect(response.status).toBe(409);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("他ユーザーが同じルームを登録済みの場合は 409 を返す", async () => {
      mocks.getRegisteredRoomOwner.mockResolvedValue({ userId: "other-user" });

      const response = await PUT(makePutRequest(validBody()));

      expect(response.status).toBe(409);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("管理者は他ユーザーが登録済みのルームでも登録できる", async () => {
      mocks.hasTopAdminRole.mockResolvedValue(true);
      mocks.getRegisteredRoomOwner.mockResolvedValue({ userId: "other-user" });

      const response = await PUT(makePutRequest(validBody()));

      expect(response.status).toBe(200);
      expect(mocks.getRegisteredRoomOwner).not.toHaveBeenCalled();
    });
  });

  describe("招待コード", () => {
    it("無効な招待コードの場合は 422 を返す", async () => {
      const { InvalidInvitationCodeError } = await import("@/lib/invitations");
      mocks.consumeInvitationCode.mockRejectedValue(
        new InvalidInvitationCodeError(),
      );

      const response = await PUT(makePutRequest(validBody()));

      expect(response.status).toBe(422);
    });
  });

  describe("正常なルーム登録", () => {
    it("登録に成功して 200 と room を返す", async () => {
      mocks.txUserRoleFindFirst.mockResolvedValue(null);

      const response = await PUT(makePutRequest(validBody()));

      expect(response.status).toBe(200);
      const data = await parseJson(response);
      expect(data.room).toEqual(registeredRoom);
    });

    it("room.register 監査ログを記録する", async () => {
      mocks.txUserRoleFindFirst.mockResolvedValue(null);
      mocks.consumeInvitationCode.mockResolvedValue({
        code: "ABCD123456",
        id: "invite-code-1",
        inviterUserId: otherUserId,
      });

      await PUT(makePutRequest(validBody()));

      expect(mocks.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: userId,
          action: "room.register",
          resource: "user_registered_room",
          resourceId: registeredRoom.roomId,
        }),
        expect.anything(),
      );
    });
  });

  describe("管理者の招待コードによるプレミアムロール自動付与", () => {
    it("管理者の招待コードを使用した場合、プレミアムロールを付与する", async () => {
      mocks.consumeInvitationCode.mockResolvedValue({
        code: "ABCD123456",
        id: "invite-code-1",
        inviterUserId: adminUserId,
      });
      mocks.txUserRoleFindFirst.mockResolvedValue({ id: "user-role-admin" });

      await PUT(makePutRequest(validBody()));

      expect(mocks.txUserRoleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_roleId: { userId, roleId: premiumRole.id } },
          create: expect.objectContaining({
            userId,
            roleId: premiumRole.id,
            assignedByUserId: adminUserId,
          }),
        }),
      );
    });

    it("管理者の招待コードを使用した場合、role.assign 監査ログを記録する", async () => {
      mocks.consumeInvitationCode.mockResolvedValue({
        code: "ABCD123456",
        id: "invite-code-1",
        inviterUserId: adminUserId,
      });
      mocks.txUserRoleFindFirst.mockResolvedValue({ id: "user-role-admin" });

      await PUT(makePutRequest(validBody()));

      expect(mocks.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: adminUserId,
          action: "role.assign",
          resource: "user",
          resourceId: userId,
          detail: expect.objectContaining({
            roleName: "premiumuser",
            reason: "admin_invite_code",
          }),
        }),
        expect.anything(),
      );
    });

    it("管理者の招待コードを使用した場合、info ログを出力する", async () => {
      mocks.consumeInvitationCode.mockResolvedValue({
        code: "ABCD123456",
        id: "invite-code-1",
        inviterUserId: adminUserId,
      });
      mocks.txUserRoleFindFirst.mockResolvedValue({ id: "user-role-admin" });

      await PUT(makePutRequest(validBody()));

      expect(mocks.loggerInfo).toHaveBeenCalledWith(
        "Premium role granted via admin invite code",
        { userId, inviterUserId: adminUserId },
      );
    });

    it("招待者が管理者でない場合、プレミアムロールを付与しない", async () => {
      mocks.consumeInvitationCode.mockResolvedValue({
        code: "ABCD123456",
        id: "invite-code-1",
        inviterUserId: otherUserId,
      });
      mocks.txUserRoleFindFirst.mockResolvedValue(null);

      await PUT(makePutRequest(validBody()));

      expect(mocks.txUserRoleUpsert).not.toHaveBeenCalled();
    });

    it("招待者が管理者でない場合、role.assign 監査ログを記録しない", async () => {
      mocks.consumeInvitationCode.mockResolvedValue({
        code: "ABCD123456",
        id: "invite-code-1",
        inviterUserId: otherUserId,
      });
      mocks.txUserRoleFindFirst.mockResolvedValue(null);

      await PUT(makePutRequest(validBody()));

      expect(mocks.writeAuditLog).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: "role.assign" }),
        expect.anything(),
      );
    });

    it("inviterUserId が null の招待コードの場合、管理者チェックをスキップしプレミアムロールを付与しない", async () => {
      mocks.consumeInvitationCode.mockResolvedValue({
        code: "ABCD123456",
        id: "invite-code-1",
        inviterUserId: null,
      });

      await PUT(makePutRequest(validBody()));

      expect(mocks.txUserRoleFindFirst).not.toHaveBeenCalled();
      expect(mocks.txUserRoleUpsert).not.toHaveBeenCalled();
    });

    it("premiumuser ロールがDBに存在しない場合、upsert を実行しない", async () => {
      mocks.consumeInvitationCode.mockResolvedValue({
        code: "ABCD123456",
        id: "invite-code-1",
        inviterUserId: adminUserId,
      });
      mocks.txUserRoleFindFirst.mockResolvedValue({ id: "user-role-admin" });
      mocks.txRoleFindUnique.mockResolvedValue(null);

      await PUT(makePutRequest(validBody()));

      expect(mocks.txUserRoleUpsert).not.toHaveBeenCalled();
    });
  });
});
