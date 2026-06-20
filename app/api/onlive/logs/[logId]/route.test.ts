import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  authzErrorResponse: vi.fn(),
  getUserRoles: vi.fn(),
  getAnyOnliveLog: vi.fn(),
  getUserOnliveLog: vi.fn(),
  updateOnliveLogTitle: vi.fn(),
  deleteUserOnliveLog: vi.fn(),
  writeAuditLog: vi.fn(),
  toJstWallTimeIsoString: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: mocks.requireUser,
  authzErrorResponse: mocks.authzErrorResponse,
  getUserRoles: mocks.getUserRoles,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/jst", () => ({
  toJstWallTimeIsoString: mocks.toJstWallTimeIsoString,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/onlive-log", () => ({
  getAnyOnliveLog: mocks.getAnyOnliveLog,
  getUserOnliveLog: mocks.getUserOnliveLog,
  updateOnliveLogTitle: mocks.updateOnliveLogTitle,
  deleteUserOnliveLog: mocks.deleteUserOnliveLog,
}));

const user = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  image: null,
};

const logRecord = {
  capturedAt: new Date("2026-06-14T00:00:00Z"),
  liveId: "20260614",
  log: { comments: [], gifts: [] },
  roomId: "room-123",
};

function makeContext(logId = "log-1") {
  return { params: Promise.resolve({ logId }) };
}

function makeRequest(method: string, body?: unknown): Request {
  return new Request(`http://localhost/api/onlive/logs/log-1`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(user);
  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: false });
  mocks.getUserOnliveLog.mockResolvedValue(logRecord);
  mocks.getAnyOnliveLog.mockResolvedValue(logRecord);
  mocks.updateOnliveLogTitle.mockResolvedValue(true);
  mocks.deleteUserOnliveLog.mockResolvedValue(true);
  mocks.writeAuditLog.mockResolvedValue(undefined);
  mocks.toJstWallTimeIsoString.mockReturnValue("2026-06-14T09:00:00.000+09:00");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/onlive/logs/[logId]", () => {
  it("空の logId は 400 を返す", async () => {
    const response = await GET(makeRequest("GET"), makeContext("   "));

    expect(response.status).toBe(400);
  });

  it("未認証の場合は 401 を返す", async () => {
    mocks.requireUser.mockRejectedValue(new Error("Unauthorized"));
    mocks.authzErrorResponse.mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await GET(makeRequest("GET"), makeContext());

    expect(response.status).toBe(401);
  });

  it("一般ユーザーは自分のログを取得できる", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: false });
    mocks.getUserOnliveLog.mockResolvedValue(logRecord);

    const response = await GET(makeRequest("GET"), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.getUserOnliveLog).toHaveBeenCalledWith(user.id, "log-1");
    expect(mocks.getAnyOnliveLog).not.toHaveBeenCalled();
  });

  it("管理者はすべてのログを取得できる", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: true, isPremium: false });
    mocks.getAnyOnliveLog.mockResolvedValue(logRecord);

    const response = await GET(makeRequest("GET"), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.getAnyOnliveLog).toHaveBeenCalledWith("log-1");
    expect(mocks.getUserOnliveLog).not.toHaveBeenCalled();
  });

  it("ログが存在しない場合は 404 を返す", async () => {
    mocks.getUserOnliveLog.mockResolvedValue(null);

    const response = await GET(makeRequest("GET"), makeContext());

    expect(response.status).toBe(404);
  });

  it("ログデータを返す", async () => {
    const response = await GET(makeRequest("GET"), makeContext());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      liveId: "20260614",
      roomId: "room-123",
    });
  });
});

describe("PATCH /api/onlive/logs/[logId]", () => {
  it("空の logId は 400 を返す", async () => {
    const response = await PATCH(
      makeRequest("PATCH", { title: "New Title" }),
      makeContext("   ")
    );

    expect(response.status).toBe(400);
  });

  it("未認証の場合は 401 を返す", async () => {
    mocks.requireUser.mockRejectedValue(new Error("Unauthorized"));
    mocks.authzErrorResponse.mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await PATCH(
      makeRequest("PATCH", { title: "New Title" }),
      makeContext()
    );

    expect(response.status).toBe(401);
  });

  it("プレミアムでも管理者でもない場合は 403 を返す", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: false });

    const response = await PATCH(
      makeRequest("PATCH", { title: "New Title" }),
      makeContext()
    );

    expect(response.status).toBe(403);
    expect(mocks.updateOnliveLogTitle).not.toHaveBeenCalled();
  });

  it("プレミアムユーザーはタイトルを更新できる", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: true });

    const response = await PATCH(
      makeRequest("PATCH", { title: "New Title" }),
      makeContext()
    );

    expect(response.status).toBe(200);
    expect(mocks.updateOnliveLogTitle).toHaveBeenCalledWith(
      user.id,
      "log-1",
      "New Title",
      false
    );
  });

  it("管理者はタイトルを更新できる", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: true, isPremium: false });

    const response = await PATCH(
      makeRequest("PATCH", { title: "Admin Title" }),
      makeContext()
    );

    expect(response.status).toBe(200);
    expect(mocks.updateOnliveLogTitle).toHaveBeenCalledWith(
      user.id,
      "log-1",
      "Admin Title",
      true
    );
  });

  it("空白のみのタイトルは null として扱う", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: true, isPremium: false });

    await PATCH(makeRequest("PATCH", { title: "   " }), makeContext());

    expect(mocks.updateOnliveLogTitle).toHaveBeenCalledWith(
      user.id,
      "log-1",
      null,
      true
    );
  });

  it("ログが存在しない場合は 404 を返す", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: true, isPremium: false });
    mocks.updateOnliveLogTitle.mockResolvedValue(false);

    const response = await PATCH(
      makeRequest("PATCH", { title: "Title" }),
      makeContext()
    );

    expect(response.status).toBe(404);
  });

  it("更新成功時は ok: true とタイトルを返す", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: true });

    const response = await PATCH(
      makeRequest("PATCH", { title: "My Title" }),
      makeContext()
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, title: "My Title" });
  });
});

describe("DELETE /api/onlive/logs/[logId]", () => {
  it("空の logId は 400 を返す", async () => {
    const response = await DELETE(makeRequest("DELETE"), makeContext("   "));

    expect(response.status).toBe(400);
  });

  it("未認証の場合は 401 を返す", async () => {
    mocks.requireUser.mockRejectedValue(new Error("Unauthorized"));
    mocks.authzErrorResponse.mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await DELETE(makeRequest("DELETE"), makeContext());

    expect(response.status).toBe(401);
  });

  it("ログが存在しない場合は 404 を返す", async () => {
    mocks.deleteUserOnliveLog.mockResolvedValue(false);

    const response = await DELETE(makeRequest("DELETE"), makeContext());

    expect(response.status).toBe(404);
  });

  it("削除成功時は ok: true を返す", async () => {
    const response = await DELETE(makeRequest("DELETE"), makeContext());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });

  it("deleteUserOnliveLog を正しい引数で呼び出す", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: false });

    await DELETE(makeRequest("DELETE"), makeContext());

    expect(mocks.deleteUserOnliveLog).toHaveBeenCalledWith(user.id, "log-1", false);
  });

  it("管理者が削除した場合は監査ログを記録する", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: true, isPremium: false });

    await DELETE(makeRequest("DELETE"), makeContext());

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: user.id,
        action: "onlive_log.delete",
        resource: "onlive_log",
        resourceId: "log-1",
        detail: { isAdmin: true },
      })
    );
  });

  it("一般ユーザーが削除した場合は監査ログを記録しない", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: false });

    await DELETE(makeRequest("DELETE"), makeContext());

    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
