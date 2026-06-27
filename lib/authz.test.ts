import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  permissionFindFirst: vi.fn(),
  userRoleFindFirst: vi.fn(),
  userRoleFindMany: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    permission: { findFirst: mocks.permissionFindFirst },
    userRole: {
      findFirst: mocks.userRoleFindFirst,
      findMany: mocks.userRoleFindMany,
    },
  },
}));

import {
  authzErrorResponse,
  ForbiddenError,
  getUserRoles,
  hasPermission,
  hasPremiumRole,
  hasRole,
  hasTopAdminRole,
  PREMIUM_ROLE_NAME,
  requirePermission,
  requireTopAdminRole,
  requireUser,
  TOP_ADMIN_ROLE_NAME,
  UnauthorizedError,
} from "./authz";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- エラークラス ----

describe("UnauthorizedError", () => {
  it("status が 401 である", () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.name).toBe("UnauthorizedError");
  });

  it("デフォルトメッセージは 'Unauthorized'", () => {
    expect(new UnauthorizedError().message).toBe("Unauthorized");
  });

  it("Error を継承している", () => {
    expect(new UnauthorizedError()).toBeInstanceOf(Error);
  });
});

describe("ForbiddenError", () => {
  it("status が 403 である", () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.name).toBe("ForbiddenError");
  });

  it("デフォルトメッセージは 'Forbidden'", () => {
    expect(new ForbiddenError().message).toBe("Forbidden");
  });

  it("カスタムメッセージを設定できる", () => {
    expect(new ForbiddenError("Banned").message).toBe("Banned");
  });
});

// ---- requireUser ----

describe("requireUser", () => {
  it("セッションがない場合は UnauthorizedError を投げる", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("ユーザー ID がない場合は UnauthorizedError を投げる", async () => {
    mocks.auth.mockResolvedValue({ user: { name: "Test" } });
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("BAN 済みユーザーは ForbiddenError を投げる", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", name: "Test" } });
    mocks.userFindUnique.mockResolvedValue({ isBanned: true });
    await expect(requireUser()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("正常なユーザーは AuthenticatedUser を返す", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "t@example.com", image: null },
    });
    mocks.userFindUnique.mockResolvedValue({ isBanned: false });
    const result = await requireUser();
    expect(result.id).toBe("user-1");
    expect(result.name).toBe("Test");
    expect(result.email).toBe("t@example.com");
    expect(result.image).toBeNull();
  });

  it("DB にユーザーが存在しない場合 (null) でも通過する", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: null, image: null },
    });
    mocks.userFindUnique.mockResolvedValue(null);
    const result = await requireUser();
    expect(result.id).toBe("user-1");
  });
});

// ---- hasPermission ----

describe("hasPermission", () => {
  it("権限があれば true を返す", async () => {
    mocks.permissionFindFirst.mockResolvedValue({ id: "perm-1" });
    expect(await hasPermission("user-1", "edit")).toBe(true);
  });

  it("権限がなければ false を返す", async () => {
    mocks.permissionFindFirst.mockResolvedValue(null);
    expect(await hasPermission("user-1", "edit")).toBe(false);
  });
});

// ---- hasRole ----

describe("hasRole", () => {
  it("ロールを持っていれば true を返す", async () => {
    mocks.userRoleFindFirst.mockResolvedValue({ id: "role-1" });
    expect(await hasRole("user-1", "admin")).toBe(true);
  });

  it("ロールを持っていなければ false を返す", async () => {
    mocks.userRoleFindFirst.mockResolvedValue(null);
    expect(await hasRole("user-1", "admin")).toBe(false);
  });
});

// ---- hasTopAdminRole / hasPremiumRole ----

describe("hasTopAdminRole", () => {
  it(`ロール名 '${TOP_ADMIN_ROLE_NAME}' で hasRole を呼ぶ`, async () => {
    mocks.userRoleFindFirst.mockResolvedValue({ id: "r" });
    const result = await hasTopAdminRole("user-1");
    expect(result).toBe(true);
    const call = mocks.userRoleFindFirst.mock.calls[0][0];
    expect(call.where.role.name).toBe(TOP_ADMIN_ROLE_NAME);
  });
});

describe("hasPremiumRole", () => {
  it(`ロール名 '${PREMIUM_ROLE_NAME}' で hasRole を呼ぶ`, async () => {
    mocks.userRoleFindFirst.mockResolvedValue({ id: "r" });
    const result = await hasPremiumRole("user-1");
    expect(result).toBe(true);
    const call = mocks.userRoleFindFirst.mock.calls[0][0];
    expect(call.where.role.name).toBe(PREMIUM_ROLE_NAME);
  });
});

// ---- getUserRoles ----

describe("getUserRoles", () => {
  it("admin と premium の両方を持つ場合", async () => {
    mocks.userRoleFindMany.mockResolvedValue([
      { role: { name: TOP_ADMIN_ROLE_NAME } },
      { role: { name: PREMIUM_ROLE_NAME } },
    ]);
    const roles = await getUserRoles("user-1");
    expect(roles.isAdmin).toBe(true);
    expect(roles.isPremium).toBe(true);
  });

  it("どちらも持たない場合", async () => {
    mocks.userRoleFindMany.mockResolvedValue([]);
    const roles = await getUserRoles("user-1");
    expect(roles.isAdmin).toBe(false);
    expect(roles.isPremium).toBe(false);
  });

  it("admin のみの場合", async () => {
    mocks.userRoleFindMany.mockResolvedValue([
      { role: { name: TOP_ADMIN_ROLE_NAME } },
    ]);
    const roles = await getUserRoles("user-1");
    expect(roles.isAdmin).toBe(true);
    expect(roles.isPremium).toBe(false);
  });
});

// ---- requireTopAdminRole ----

describe("requireTopAdminRole", () => {
  it("admin ロールがない場合は ForbiddenError を投げる", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.userFindUnique.mockResolvedValue({ isBanned: false });
    mocks.userRoleFindFirst.mockResolvedValue(null);
    await expect(requireTopAdminRole()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("admin ロールがある場合はユーザーを返す", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "user-1", name: "Admin", email: null, image: null },
    });
    mocks.userFindUnique.mockResolvedValue({ isBanned: false });
    mocks.userRoleFindFirst.mockResolvedValue({ id: "r" });
    const user = await requireTopAdminRole();
    expect(user.id).toBe("user-1");
  });
});

// ---- requirePermission ----

describe("requirePermission", () => {
  it("権限がない場合は ForbiddenError を投げる", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.userFindUnique.mockResolvedValue({ isBanned: false });
    mocks.permissionFindFirst.mockResolvedValue(null);
    await expect(requirePermission("edit")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("権限がある場合はユーザーを返す", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "user-1", name: "U", email: null, image: null },
    });
    mocks.userFindUnique.mockResolvedValue({ isBanned: false });
    mocks.permissionFindFirst.mockResolvedValue({ id: "p" });
    const user = await requirePermission("edit");
    expect(user.id).toBe("user-1");
  });
});

// ---- authzErrorResponse ----

describe("authzErrorResponse", () => {
  it("UnauthorizedError は status 401 の Response を返す", () => {
    const res = authzErrorResponse(new UnauthorizedError());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("ForbiddenError は status 403 の Response を返す", () => {
    const res = authzErrorResponse(new ForbiddenError());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("その他のエラーは null を返す", () => {
    expect(authzErrorResponse(new Error("other"))).toBeNull();
    expect(authzErrorResponse("string error")).toBeNull();
    expect(authzErrorResponse(null)).toBeNull();
  });
});
