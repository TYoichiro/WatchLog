import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userBlockFindMany: vi.fn(),
  userBlockUpsert: vi.fn(),
  userBlockDeleteMany: vi.fn(),
  unstable_cache: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("next/cache", () => ({
  unstable_cache: mocks.unstable_cache,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userBlock: {
      findMany: mocks.userBlockFindMany,
      upsert: mocks.userBlockUpsert,
      deleteMany: mocks.userBlockDeleteMany,
    },
  },
}));

vi.mock("@/lib/jst", () => ({
  toJstWallTimeIsoString: (d: Date) => d.toISOString(),
}));

import {
  blockedUserIdsCacheTag,
  createUserBlock,
  deleteUserBlock,
  DeveloperBlockForbiddenError,
  getOptionalBlockedUserIds,
  listBlockedShowroomUserIds,
  listUserBlocks,
  serializeUserBlock,
} from "./user-blocks";
import { DEVELOPER_USER_ID } from "./showroom-users";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- DeveloperBlockForbiddenError ----

describe("DeveloperBlockForbiddenError", () => {
  it("status が 403 である", () => {
    expect(new DeveloperBlockForbiddenError().status).toBe(403);
  });

  it("Error を継承している", () => {
    expect(new DeveloperBlockForbiddenError()).toBeInstanceOf(Error);
  });
});

// ---- serializeUserBlock ----

describe("serializeUserBlock", () => {
  const block = {
    id: "b-1",
    blockedUserId: "u-99",
    blockedUserName: "テストユーザー",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  };

  it("id / blockedUserId / blockedUserName をそのまま含む", () => {
    const result = serializeUserBlock(block);
    expect(result.id).toBe("b-1");
    expect(result.blockedUserId).toBe("u-99");
    expect(result.blockedUserName).toBe("テストユーザー");
  });

  it("createdAt / updatedAt を ISO 文字列に変換する", () => {
    const result = serializeUserBlock(block);
    expect(typeof result.createdAt).toBe("string");
    expect(typeof result.updatedAt).toBe("string");
  });
});

// ---- blockedUserIdsCacheTag ----

describe("blockedUserIdsCacheTag", () => {
  it("ユーザー ID を含むキャッシュタグを返す", () => {
    const tag = blockedUserIdsCacheTag("user-42");
    expect(tag).toContain("user-42");
  });
});

// ---- listUserBlocks ----

describe("listUserBlocks", () => {
  it("ブロック一覧を UserBlockData 形式にマッピングして返す", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    mocks.userBlockFindMany.mockResolvedValue([
      {
        id: "b-1",
        blockedShowroomUserId: "sr-1",
        blockedShowroomUserName: "ユーザー1",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await listUserBlocks("user-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b-1");
    expect(result[0].blockedUserId).toBe("sr-1");
    expect(result[0].blockedUserName).toBe("ユーザー1");
  });

  it("ブロックがない場合は空配列を返す", async () => {
    mocks.userBlockFindMany.mockResolvedValue([]);
    expect(await listUserBlocks("user-1")).toHaveLength(0);
  });
});

// ---- listBlockedShowroomUserIds ----

describe("listBlockedShowroomUserIds", () => {
  it("ブロック済みの SHOWROOM ユーザー ID 一覧を返す", async () => {
    mocks.userBlockFindMany.mockResolvedValue([
      { blockedShowroomUserId: "sr-1" },
      { blockedShowroomUserId: "sr-2" },
    ]);
    const result = await listBlockedShowroomUserIds("user-1");
    expect(result).toEqual(["sr-1", "sr-2"]);
  });
});

// ---- createUserBlock ----

describe("createUserBlock", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("開発者ユーザーをブロックしようとすると DeveloperBlockForbiddenError を投げる", async () => {
    await expect(
      createUserBlock("user-1", {
        blockedUserId: DEVELOPER_USER_ID,
        blockedUserName: "Developer",
      })
    ).rejects.toBeInstanceOf(DeveloperBlockForbiddenError);
    expect(mocks.userBlockUpsert).not.toHaveBeenCalled();
  });

  it("通常ユーザーはブロックできる", async () => {
    mocks.userBlockUpsert.mockResolvedValue({
      id: "b-1",
      blockedShowroomUserId: "sr-99",
      blockedShowroomUserName: "Test",
      createdAt: now,
      updatedAt: now,
    });

    const result = await createUserBlock("user-1", {
      blockedUserId: "sr-99",
      blockedUserName: "Test",
    });

    expect(result.blockedUserId).toBe("sr-99");
    expect(mocks.userBlockUpsert).toHaveBeenCalledOnce();
  });
});

// ---- deleteUserBlock ----

describe("deleteUserBlock", () => {
  it("削除に成功した場合は true を返す", async () => {
    mocks.userBlockDeleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteUserBlock("user-1", "b-1")).toBe(true);
  });

  it("対象が存在しない場合は false を返す", async () => {
    mocks.userBlockDeleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteUserBlock("user-1", "b-999")).toBe(false);
  });
});

// ---- getOptionalBlockedUserIds ----

describe("getOptionalBlockedUserIds", () => {
  it("未認証の場合は空 Set を返す", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await getOptionalBlockedUserIds();
    expect(result.size).toBe(0);
  });

  it("認証済みの場合はキャッシュ経由でブロック ID を返す", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.unstable_cache.mockImplementation(
      (fn: () => Promise<string[]>) => fn
    );
    mocks.userBlockFindMany.mockResolvedValue([
      { blockedShowroomUserId: "sr-1" },
    ]);
    const result = await getOptionalBlockedUserIds();
    expect(result).toBeInstanceOf(Set);
  });
});
