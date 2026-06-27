import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  authzErrorResponse: vi.fn(),
  loggerError: vi.fn(),
  requirePermission: vi.fn(),
  auditLogFindMany: vi.fn(),
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
    auditLog: { findMany: mocks.auditLogFindMany },
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

const dbAuditLog = {
  id: "audit-1",
  actorUserId: "admin-1",
  action: "user.ban",
  resource: "user",
  resourceId: "user-1",
  detail: { banned: true },
  createdAt: new Date("2026-06-01T00:00:00Z"),
  actor: {
    id: "admin-1",
    name: "Admin",
    email: "admin@example.com",
    image: null,
  },
};

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/admin/audit-logs");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.requirePermission.mockResolvedValue(actor);
  mocks.auditLogFindMany.mockResolvedValue([dbAuditLog]);
  mocks.toJstWallTimeIsoString.mockImplementation((d: Date) => d.toISOString());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/audit-logs", () => {
  it("監査ログ一覧を 200 で返す", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const body = await expectJson(response);
    expect(Array.isArray((body as { auditLogs: unknown[] }).auditLogs)).toBe(true);
  });

  it("requirePermission に audit.read を渡す", async () => {
    await GET(makeRequest());

    expect(mocks.requirePermission).toHaveBeenCalledWith("audit.read");
  });

  it("レスポンスに id / action / resource / resourceId / detail / createdAt / actor を含む", async () => {
    const response = await GET(makeRequest());
    const body = await expectJson(response) as { auditLogs: Record<string, unknown>[] };
    const log = body.auditLogs[0];

    expect(log.id).toBe("audit-1");
    expect(log.action).toBe("user.ban");
    expect(log.resource).toBe("user");
    expect(log.resourceId).toBe("user-1");
    expect(log.detail).toEqual({ banned: true });
    expect(typeof log.createdAt).toBe("string");
    expect(log.actor).toBeDefined();
  });

  it("actor に id / name / email / image を含む", async () => {
    const response = await GET(makeRequest());
    const body = await expectJson(response) as { auditLogs: { actor: Record<string, unknown> }[] };
    const actor = body.auditLogs[0].actor;

    expect(actor.id).toBe("admin-1");
    expect(actor.name).toBe("Admin");
    expect(actor.email).toBe("admin@example.com");
    expect(actor.image).toBeNull();
  });

  it("デフォルト limit 50 で findMany を呼ぶ", async () => {
    await GET(makeRequest());

    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("limit クエリパラメータを反映する", async () => {
    await GET(makeRequest({ limit: "10" }));

    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("limit が 100 を超える場合は 100 に制限する", async () => {
    await GET(makeRequest({ limit: "200" }));

    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("limit が 1 未満の場合は 1 に制限する", async () => {
    await GET(makeRequest({ limit: "0" }));

    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });

  it("limit が整数でない場合はデフォルト 50 を使う", async () => {
    await GET(makeRequest({ limit: "abc" }));

    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("limit が小数の場合はデフォルト 50 を使う", async () => {
    await GET(makeRequest({ limit: "10.5" }));

    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("createdAt の降順で取得する", async () => {
    await GET(makeRequest());

    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("createdAt を JST 文字列に変換する", async () => {
    const date = new Date("2026-06-01T00:00:00Z");
    mocks.toJstWallTimeIsoString.mockReturnValue("2026-06-01T09:00:00+09:00");

    const response = await GET(makeRequest());
    const body = await expectJson(response) as { auditLogs: Record<string, unknown>[] };

    expect(mocks.toJstWallTimeIsoString).toHaveBeenCalledWith(date);
    expect(body.auditLogs[0].createdAt).toBe("2026-06-01T09:00:00+09:00");
  });

  it("ログがない場合は空配列を返す", async () => {
    mocks.auditLogFindMany.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const body = await expectJson(response) as { auditLogs: unknown[] };

    expect(response.status).toBe(200);
    expect(body.auditLogs).toHaveLength(0);
  });

  it("認可エラーをそのまま返す", async () => {
    const error = new Error("Forbidden");
    const authzResponse = Response.json({ error: "Forbidden" }, { status: 403 });
    mocks.requirePermission.mockRejectedValue(error);
    mocks.authzErrorResponse.mockReturnValue(authzResponse);

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled();
  });

  it("DB エラー時は 500 を返す", async () => {
    mocks.auditLogFindMany.mockRejectedValue(new Error("db error"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "管理者: 監査ログの取得に失敗しました",
      { error: "Error: db error" },
    );
  });
});
