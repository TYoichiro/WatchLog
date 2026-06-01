import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  authzErrorResponse: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  requireTopAdminRole: vi.fn(),
  maintenanceWindowFindMany: vi.fn(),
  maintenanceWindowCreate: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/authz", () => ({
  authzErrorResponse: mocks.authzErrorResponse,
  requireTopAdminRole: mocks.requireTopAdminRole,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    maintenanceWindow: {
      findMany: mocks.maintenanceWindowFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

const actor = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@example.com",
  image: null,
};

const now = new Date("2026-05-14T01:00:00.000Z");

const sampleWindow = {
  id: "window-1",
  title: "システムメンテナンス",
  message: "メンテナンス中です",
  startsAt: new Date("2026-05-14T10:00:00.000Z"),
  endsAt: new Date("2026-05-14T13:00:00.000Z"),
  isEnabled: true,
  createdAt: new Date("2026-05-13T10:00:00.000Z"),
  updatedAt: new Date("2026-05-13T10:00:00.000Z"),
};

const serializedWindow = {
  id: "window-1",
  title: "システムメンテナンス",
  message: "メンテナンス中です",
  startsAt: "2026-05-14T10:00:00.000+09:00",
  endsAt: "2026-05-14T13:00:00.000+09:00",
  isEnabled: true,
  createdAt: "2026-05-13T10:00:00.000+09:00",
  updatedAt: "2026-05-13T10:00:00.000+09:00",
};

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/maintenance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();

  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.requireTopAdminRole.mockResolvedValue(actor);
  mocks.writeAuditLog.mockResolvedValue({ id: "audit-1", createdAt: now });
  mocks.transaction.mockImplementation(
    async (
      callback: (tx: {
        maintenanceWindow: { create: typeof mocks.maintenanceWindowCreate };
      }) => Promise<unknown>,
    ) =>
      callback({
        maintenanceWindow: { create: mocks.maintenanceWindowCreate },
      }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/admin/maintenance", () => {
  it("returns maintenance windows list", async () => {
    mocks.maintenanceWindowFindMany.mockResolvedValue([sampleWindow]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await expectJson(response)).toEqual({
      maintenanceWindows: [serializedWindow],
    });
    expect(mocks.requireTopAdminRole).toHaveBeenCalledTimes(1);
    expect(mocks.maintenanceWindowFindMany).toHaveBeenCalledWith({
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        message: true,
        startsAt: true,
        endsAt: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("returns empty list when no windows exist", async () => {
    mocks.maintenanceWindowFindMany.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await expectJson(response)).toEqual({ maintenanceWindows: [] });
  });

  it("returns authorization error for non-admin", async () => {
    const error = new Error("Forbidden");
    const authzResponse = Response.json({ error: "Forbidden" }, { status: 403 });
    mocks.requireTopAdminRole.mockRejectedValue(error);
    mocks.authzErrorResponse.mockReturnValue(authzResponse);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await expectJson(response)).toEqual({ error: "Forbidden" });
    expect(mocks.maintenanceWindowFindMany).not.toHaveBeenCalled();
  });

  it("returns 500 when DB query fails", async () => {
    const error = new Error("database failed");
    mocks.maintenanceWindowFindMany.mockRejectedValue(error);

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
    expect(mocks.loggerError).toHaveBeenCalledWith("管理者: メンテナンス期間一覧の取得に失敗しました", {
      error: "Error: database failed",
    });
  });
});

describe("POST /api/admin/maintenance", () => {
  beforeEach(() => {
    mocks.maintenanceWindowCreate.mockResolvedValue(sampleWindow);
  });

  it("creates a maintenance window successfully", async () => {
    const request = makeRequest({
      title: "システムメンテナンス",
      message: "メンテナンス中です",
      startsAt: "2026-05-14T10:00",
      endsAt: "2026-05-14T13:00",
      isEnabled: true,
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(await expectJson(response)).toEqual({
      maintenanceWindow: serializedWindow,
    });
    expect(mocks.requireTopAdminRole).toHaveBeenCalledTimes(1);
    expect(mocks.maintenanceWindowCreate).toHaveBeenCalledWith({
      data: {
        title: "システムメンテナンス",
        message: "メンテナンス中です",
        startsAt: new Date("2026-05-14T10:00:00.000Z"),
        endsAt: new Date("2026-05-14T13:00:00.000Z"),
        isEnabled: true,
      },
      select: {
        id: true,
        title: true,
        message: true,
        startsAt: true,
        endsAt: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      {
        actorUserId: "admin-1",
        action: "maintenance_window.create",
        resource: "maintenance_window",
        resourceId: "window-1",
        detail: {
          title: "システムメンテナンス",
          startsAt: "2026-05-14T10:00:00.000+09:00",
          endsAt: "2026-05-14T13:00:00.000+09:00",
          isEnabled: true,
        },
      },
      { maintenanceWindow: { create: mocks.maintenanceWindowCreate } },
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith("メンテナンス期間を作成しました", {
      actorId: "admin-1",
      windowId: "window-1",
    });
  });

  it("defaults isEnabled to true when not provided", async () => {
    const request = makeRequest({
      title: "メンテナンス",
      startsAt: "2026-05-14T10:00",
      endsAt: "2026-05-14T13:00",
    });

    await POST(request);

    expect(mocks.maintenanceWindowCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isEnabled: true }),
      }),
    );
  });

  it("sets message to null when empty string provided", async () => {
    const request = makeRequest({
      title: "メンテナンス",
      message: "",
      startsAt: "2026-05-14T10:00",
      endsAt: "2026-05-14T13:00",
    });

    await POST(request);

    expect(mocks.maintenanceWindowCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: null }),
      }),
    );
  });

  it("returns 400 when title is missing", async () => {
    const request = makeRequest({
      startsAt: "2026-05-14T10:00",
      endsAt: "2026-05-14T13:00",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await expectJson(response)).toEqual({ error: "title is required" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when title is empty string", async () => {
    const request = makeRequest({
      title: "  ",
      startsAt: "2026-05-14T10:00",
      endsAt: "2026-05-14T13:00",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await expectJson(response)).toEqual({ error: "title is required" });
  });

  it("returns 400 when startsAt is missing", async () => {
    const request = makeRequest({
      title: "メンテナンス",
      endsAt: "2026-05-14T13:00",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await expectJson(response)).toEqual({ error: "startsAt is required" });
  });

  it("returns 400 when endsAt is missing", async () => {
    const request = makeRequest({
      title: "メンテナンス",
      startsAt: "2026-05-14T10:00",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await expectJson(response)).toEqual({ error: "endsAt is required" });
  });

  it("returns 400 when endsAt is not after startsAt", async () => {
    const request = makeRequest({
      title: "メンテナンス",
      startsAt: "2026-05-14T13:00",
      endsAt: "2026-05-14T10:00",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await expectJson(response)).toEqual({
      error: "endsAt must be after startsAt",
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await expectJson(response)).toEqual({ error: "Invalid JSON" });
  });

  it("returns authorization error", async () => {
    const error = new Error("Forbidden");
    const authzResponse = Response.json({ error: "Forbidden" }, { status: 403 });
    mocks.requireTopAdminRole.mockRejectedValue(error);
    mocks.authzErrorResponse.mockReturnValue(authzResponse);

    const request = makeRequest({
      title: "メンテナンス",
      startsAt: "2026-05-14T10:00",
      endsAt: "2026-05-14T13:00",
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 500 when transaction fails", async () => {
    const error = new Error("database failed");
    mocks.transaction.mockRejectedValue(error);

    const request = makeRequest({
      title: "メンテナンス",
      startsAt: "2026-05-14T10:00",
      endsAt: "2026-05-14T13:00",
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "管理者: メンテナンス期間の作成に失敗しました",
      { error: "Error: database failed" },
    );
  });
});
