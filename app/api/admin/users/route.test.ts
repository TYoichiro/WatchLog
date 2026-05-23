import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  authzErrorResponse: vi.fn(),
  loggerError: vi.fn(),
  requirePermission: vi.fn(),
  userFindMany: vi.fn(),
  toJstWallTimeIsoString: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  authzErrorResponse: mocks.authzErrorResponse,
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
  },
}));

vi.mock("@/lib/jst", () => ({
  toJstWallTimeIsoString: mocks.toJstWallTimeIsoString,
}));

const actor = {
  id: "admin-1",
  name: "Admin",
  email: "admin@example.com",
  image: null,
};

const dbUser = {
  id: "user-1",
  name: "User One",
  email: "user1@example.com",
  image: null,
  isBanned: false,
  createdAt: new Date("2026-05-01T00:00:00Z"),
  updatedAt: new Date("2026-05-01T00:00:00Z"),
  userRoles: [
    {
      assignedAt: new Date("2026-05-01T00:00:00Z"),
      role: { id: "role-1", name: "user", description: "Default user" },
    },
  ],
};

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.requirePermission.mockResolvedValue(actor);
  mocks.userFindMany.mockResolvedValue([dbUser]);
  mocks.toJstWallTimeIsoString.mockImplementation((d: Date) => d.toISOString());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/users", () => {
  it("ユーザー一覧を 200 で返す", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await expectJson(response);
    expect(Array.isArray((body as { users: unknown[] }).users)).toBe(true);
  });

  it("requirePermission に user.read を渡す", async () => {
    await GET();

    expect(mocks.requirePermission).toHaveBeenCalledWith("user.read");
  });

  it("レスポンスに isBanned を含む", async () => {
    const response = await GET();
    const body = await expectJson(response) as { users: Record<string, unknown>[] };

    expect(body.users[0].isBanned).toBe(false);
  });

  it("BAN されたユーザーの isBanned が true", async () => {
    mocks.userFindMany.mockResolvedValue([{ ...dbUser, isBanned: true }]);

    const response = await GET();
    const body = await expectJson(response) as { users: Record<string, unknown>[] };

    expect(body.users[0].isBanned).toBe(true);
  });

  it("レスポンスに id / name / email / roles を含む", async () => {
    const response = await GET();
    const body = await expectJson(response) as { users: Record<string, unknown>[] };
    const user = body.users[0];

    expect(user.id).toBe("user-1");
    expect(user.name).toBe("User One");
    expect(user.email).toBe("user1@example.com");
    expect(Array.isArray(user.roles)).toBe(true);
  });

  it("ユーザーがいない場合は空配列を返す", async () => {
    mocks.userFindMany.mockResolvedValue([]);

    const response = await GET();
    const body = await expectJson(response) as { users: unknown[] };

    expect(response.status).toBe(200);
    expect(body.users).toHaveLength(0);
  });

  it("認可エラーをそのまま返す", async () => {
    const error = new Error("Forbidden");
    const authzResponse = Response.json({ error: "Forbidden" }, { status: 403 });
    mocks.requirePermission.mockRejectedValue(error);
    mocks.authzErrorResponse.mockReturnValue(authzResponse);

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("DB エラー時は 500 を返す", async () => {
    mocks.userFindMany.mockRejectedValue(new Error("db error"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "Admin user list failed",
      { error: "Error: db error" },
    );
  });
});
