import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeInvitationCode,
  ensureUserInvitationCodes,
  generateInvitationCode,
  INVITATION_CODE_LENGTH,
  InvalidInvitationCodeError,
  isInvitationCodeAvailable,
  isInvitationCodeFormatValid,
  normalizeInvitationCode,
  USER_INVITATION_CODE_LIMIT,
} from "./invitations";

// ---- pure function tests (no mocks needed) ----

describe("normalizeInvitationCode", () => {
  it("文字列をトリムして大文字に変換する", () => {
    expect(normalizeInvitationCode("  abcd123456  ")).toBe("ABCD123456");
  });

  it("空文字列は null を返す", () => {
    expect(normalizeInvitationCode("   ")).toBeNull();
  });

  it("文字列以外は null を返す", () => {
    expect(normalizeInvitationCode(null)).toBeNull();
    expect(normalizeInvitationCode(123)).toBeNull();
    expect(normalizeInvitationCode(undefined)).toBeNull();
  });
});

describe("isInvitationCodeFormatValid", () => {
  it("10桁の大文字英数字は有効", () => {
    expect(isInvitationCodeFormatValid("ABCD123456")).toBe(true);
    expect(isInvitationCodeFormatValid("0123456789")).toBe(true);
    expect(isInvitationCodeFormatValid("AAAAAAAAAA")).toBe(true);
  });

  it("10桁未満は無効", () => {
    expect(isInvitationCodeFormatValid("ABCD12345")).toBe(false);
  });

  it("10桁超は無効", () => {
    expect(isInvitationCodeFormatValid("ABCD1234567")).toBe(false);
  });

  it("小文字を含む場合は無効", () => {
    expect(isInvitationCodeFormatValid("abcd123456")).toBe(false);
  });

  it("記号を含む場合は無効", () => {
    expect(isInvitationCodeFormatValid("ABCD12345!")).toBe(false);
  });

  it("空文字列は無効", () => {
    expect(isInvitationCodeFormatValid("")).toBe(false);
  });
});

describe("generateInvitationCode", () => {
  it(`${INVITATION_CODE_LENGTH}桁の大文字英数字コードを生成する`, () => {
    const code = generateInvitationCode();
    expect(code).toHaveLength(INVITATION_CODE_LENGTH);
    expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
  });

  it("生成するたびに異なるコードになる（確率的）", () => {
    const codes = new Set(Array.from({ length: 20 }, generateInvitationCode));
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ---- DB-dependent tests (Prisma mocked) ----

const mocks = vi.hoisted(() => ({
  invitationCodeFindUnique: vi.fn(),
  invitationCodeCount: vi.fn(),
  invitationCodeCreate: vi.fn(),
  invitationCodeUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invitationCode: {
      findUnique: mocks.invitationCodeFindUnique,
      count: mocks.invitationCodeCount,
      create: mocks.invitationCodeCreate,
      updateMany: mocks.invitationCodeUpdateMany,
    },
  },
}));

vi.mock("@/lib/jst", () => ({
  toJstWallTimeDate: () => new Date("2026-06-14T00:00:00Z"),
}));

function makeClient() {
  return {
    invitationCode: {
      findUnique: mocks.invitationCodeFindUnique,
      count: mocks.invitationCodeCount,
      create: mocks.invitationCodeCreate,
      updateMany: mocks.invitationCodeUpdateMany,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isInvitationCodeAvailable", () => {
  it("有効な未使用コードは true を返す", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue({
      isDeleted: false,
      usedAt: null,
      usedByUserId: null,
    });

    const result = await isInvitationCodeAvailable("ABCD123456", makeClient());

    expect(result).toBe(true);
  });

  it("コードが存在しない場合は false を返す", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue(null);

    const result = await isInvitationCodeAvailable("ABCD123456", makeClient());

    expect(result).toBe(false);
  });

  it("削除済みコードは false を返す", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue({
      isDeleted: true,
      usedAt: null,
      usedByUserId: null,
    });

    const result = await isInvitationCodeAvailable("ABCD123456", makeClient());

    expect(result).toBe(false);
  });

  it("使用済みコード（usedAt あり）は false を返す", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue({
      isDeleted: false,
      usedAt: new Date(),
      usedByUserId: "user-1",
    });

    const result = await isInvitationCodeAvailable("ABCD123456", makeClient());

    expect(result).toBe(false);
  });

  it("フォーマット不正なコードは false を返す（DBアクセスなし）", async () => {
    const result = await isInvitationCodeAvailable("bad!", makeClient());

    expect(result).toBe(false);
    expect(mocks.invitationCodeFindUnique).not.toHaveBeenCalled();
  });

  it("null を渡すと false を返す", async () => {
    const result = await isInvitationCodeAvailable(null, makeClient());

    expect(result).toBe(false);
    expect(mocks.invitationCodeFindUnique).not.toHaveBeenCalled();
  });
});

describe("consumeInvitationCode", () => {
  const userId = "user-1";
  const validCode = "ABCD123456";
  const invitationCodeRecord = {
    id: "inv-1",
    isDeleted: false,
    usedAt: null,
    usedByUserId: null,
    inviterUserId: "inviter-1",
  };

  it("有効なコードを消費して返す", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue(invitationCodeRecord);
    mocks.invitationCodeUpdateMany.mockResolvedValue({ count: 1 });

    const result = await consumeInvitationCode(validCode, userId, makeClient());

    expect(result.code).toBe(validCode);
    expect(result.id).toBe("inv-1");
    expect(result.inviterUserId).toBe("inviter-1");
    expect(mocks.invitationCodeUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isDeleted: true,
          usedByUserId: userId,
        }),
        where: expect.objectContaining({
          id: "inv-1",
          isDeleted: false,
          usedAt: null,
          usedByUserId: null,
        }),
      })
    );
  });

  it("フォーマット不正なコードは InvalidInvitationCodeError を投げる", async () => {
    await expect(
      consumeInvitationCode("BAD!", userId, makeClient())
    ).rejects.toBeInstanceOf(InvalidInvitationCodeError);
    expect(mocks.invitationCodeFindUnique).not.toHaveBeenCalled();
  });

  it("存在しないコードは InvalidInvitationCodeError を投げる", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue(null);

    await expect(
      consumeInvitationCode(validCode, userId, makeClient())
    ).rejects.toBeInstanceOf(InvalidInvitationCodeError);
  });

  it("削除済みコードは InvalidInvitationCodeError を投げる", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue({
      ...invitationCodeRecord,
      isDeleted: true,
    });

    await expect(
      consumeInvitationCode(validCode, userId, makeClient())
    ).rejects.toBeInstanceOf(InvalidInvitationCodeError);
  });

  it("使用済みコードは InvalidInvitationCodeError を投げる", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue({
      ...invitationCodeRecord,
      usedAt: new Date(),
      usedByUserId: "other-user",
    });

    await expect(
      consumeInvitationCode(validCode, userId, makeClient())
    ).rejects.toBeInstanceOf(InvalidInvitationCodeError);
  });

  it("updateMany の count が 0 の場合（競合）は InvalidInvitationCodeError を投げる", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue(invitationCodeRecord);
    mocks.invitationCodeUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      consumeInvitationCode(validCode, userId, makeClient())
    ).rejects.toBeInstanceOf(InvalidInvitationCodeError);
  });

  it("inviterUserId が null のコードも消費できる", async () => {
    mocks.invitationCodeFindUnique.mockResolvedValue({
      ...invitationCodeRecord,
      inviterUserId: null,
    });
    mocks.invitationCodeUpdateMany.mockResolvedValue({ count: 1 });

    const result = await consumeInvitationCode(validCode, userId, makeClient());

    expect(result.inviterUserId).toBeNull();
  });
});

describe("ensureUserInvitationCodes", () => {
  const userId = "user-1";

  it(`コードが 0 件の場合は ${USER_INVITATION_CODE_LIMIT} 件作成する`, async () => {
    mocks.invitationCodeCount.mockResolvedValue(0);
    mocks.invitationCodeCreate.mockResolvedValue({ id: "new-inv" });

    await ensureUserInvitationCodes(userId, makeClient());

    expect(mocks.invitationCodeCreate).toHaveBeenCalledTimes(
      USER_INVITATION_CODE_LIMIT
    );
  });

  it("既に上限に達している場合は何も作成しない", async () => {
    mocks.invitationCodeCount.mockResolvedValue(USER_INVITATION_CODE_LIMIT);

    await ensureUserInvitationCodes(userId, makeClient());

    expect(mocks.invitationCodeCreate).not.toHaveBeenCalled();
  });

  it("1 件不足している場合は 1 件だけ作成する", async () => {
    mocks.invitationCodeCount.mockResolvedValue(USER_INVITATION_CODE_LIMIT - 1);
    mocks.invitationCodeCreate.mockResolvedValue({ id: "new-inv" });

    await ensureUserInvitationCodes(userId, makeClient());

    expect(mocks.invitationCodeCreate).toHaveBeenCalledTimes(1);
    expect(mocks.invitationCodeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { code: expect.any(String), inviterUserId: userId },
        select: { id: true },
      })
    );
  });
});
