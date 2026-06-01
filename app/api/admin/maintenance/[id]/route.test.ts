import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  authzErrorResponse: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  requireTopAdminRole: vi.fn(),
  maintenanceWindowFindUnique: vi.fn(),
  maintenanceWindowUpdate: vi.fn(),
  maintenanceWindowDelete: vi.fn(),
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
      findUnique: mocks.maintenanceWindowFindUnique,
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

const existingWindow = {
  id: "window-1",
  startsAt: new Date("2026-05-14T10:00:00.000Z"),
  endsAt: new Date("2026-05-14T13:00:00.000Z"),
};

const updatedWindow = {
  id: "window-1",
  title: "更新後のメンテナンス",
  message: "更新されたメッセージ",
  startsAt: new Date("2026-05-14T10:00:00.000Z"),
  endsAt: new Date("2026-05-14T13:00:00.000Z"),
  isEnabled: true,
  createdAt: new Date("2026-05-13T10:00:00.000Z"),
  updatedAt: new Date("2026-05-14T01:00:00.000Z"),
};

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makePatchRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/admin/maintenance/${id}`, {
    method: "PATCH",
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
  mocks.maintenanceWindowFindUnique.mockResolvedValue(existingWindow);
  mocks.transaction.mockImplementation(
    async (
      callback: (tx: {
        maintenanceWindow: {
          update: typeof mocks.maintenanceWindowUpdate;
          delete: typeof mocks.maintenanceWindowDelete;
        };
      }) => Promise<unknown>,
    ) =>
      callback({
        maintenanceWindow: {
          update: mocks.maintenanceWindowUpdate,
          delete: mocks.maintenanceWindowDelete,
        },
      }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PATCH /api/admin/maintenance/[id]", () => {
  beforeEach(() => {
    mocks.maintenanceWindowUpdate.mockResolvedValue(updatedWindow);
  });

  it("updates a maintenance window successfully", async () => {
    const request = makePatchRequest("window-1", {
      title: "更新後のメンテナンス",
      message: "更新されたメッセージ",
      startsAt: "2026-05-14T10:00",
      endsAt: "2026-05-14T13:00",
      isEnabled: true,
    });

    const response = await PATCH(request, makeParams("window-1"));

    expect(response.status).toBe(200);
    expect(await expectJson(response)).toEqual({
      maintenanceWindow: {
        id: "window-1",
        title: "更新後のメンテナンス",
        message: "更新されたメッセージ",
        startsAt: "2026-05-14T10:00:00.000+09:00",
        endsAt: "2026-05-14T13:00:00.000+09:00",
        isEnabled: true,
        createdAt: "2026-05-13T10:00:00.000+09:00",
        updatedAt: "2026-05-14T01:00:00.000+09:00",
      },
    });
    expect(mocks.requireTopAdminRole).toHaveBeenCalledTimes(1);
    expect(mocks.maintenanceWindowFindUnique).toHaveBeenCalledWith({
      where: { id: "window-1" },
      select: { id: true, startsAt: true, endsAt: true },
    });
    expect(mocks.maintenanceWindowUpdate).toHaveBeenCalledWith({
      where: { id: "window-1" },
      data: {
        title: "更新後のメンテナンス",
        message: "更新されたメッセージ",
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
    expect(mocks.loggerInfo).toHaveBeenCalledWith("メンテナンス期間を更新しました", {
      actorId: "admin-1",
      windowId: "window-1",
    });
  });

  it("updates only the provided fields", async () => {
    const request = makePatchRequest("window-1", { isEnabled: false });

    await PATCH(request, makeParams("window-1"));

    expect(mocks.maintenanceWindowUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isEnabled: false },
      }),
    );
  });

  it("disables an active maintenance window and writes audit log", async () => {
    const disabledWindow = { ...updatedWindow, isEnabled: false };
    mocks.maintenanceWindowUpdate.mockResolvedValue(disabledWindow);

    const request = makePatchRequest("window-1", { isEnabled: false });

    const response = await PATCH(request, makeParams("window-1"));

    expect(response.status).toBe(200);
    const body = await expectJson(response);
    expect((body.maintenanceWindow as Record<string, unknown>).isEnabled).toBe(false);
    expect(mocks.maintenanceWindowUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isEnabled: false } }),
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        action: "maintenance_window.update",
        resource: "maintenance_window",
        resourceId: "window-1",
        detail: { isEnabled: false },
      }),
      expect.any(Object),
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith("メンテナンス期間を更新しました", {
      actorId: "admin-1",
      windowId: "window-1",
    });
  });

  it("sets message to null when empty string provided", async () => {
    const request = makePatchRequest("window-1", { message: "" });

    await PATCH(request, makeParams("window-1"));

    expect(mocks.maintenanceWindowUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { message: null },
      }),
    );
  });

  it("returns 404 when window does not exist", async () => {
    mocks.maintenanceWindowFindUnique.mockResolvedValue(null);

    const request = makePatchRequest("no-such-id", { title: "test" });

    const response = await PATCH(request, makeParams("no-such-id"));

    expect(response.status).toBe(404);
    expect(await expectJson(response)).toEqual({ error: "Not Found" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when title is empty string", async () => {
    const request = makePatchRequest("window-1", { title: "" });

    const response = await PATCH(request, makeParams("window-1"));

    expect(response.status).toBe(400);
    expect(await expectJson(response)).toEqual({
      error: "title cannot be empty",
    });
    expect(mocks.maintenanceWindowFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when endsAt is not after startsAt", async () => {
    const request = makePatchRequest("window-1", {
      startsAt: "2026-05-14T13:00",
      endsAt: "2026-05-14T10:00",
    });

    const response = await PATCH(request, makeParams("window-1"));

    expect(response.status).toBe(400);
    expect(await expectJson(response)).toEqual({
      error: "endsAt must be after startsAt",
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost/api/admin/maintenance/window-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const response = await PATCH(request, makeParams("window-1"));

    expect(response.status).toBe(400);
    expect(await expectJson(response)).toEqual({ error: "Invalid JSON" });
  });

  it("returns authorization error", async () => {
    const error = new Error("Forbidden");
    const authzResponse = Response.json({ error: "Forbidden" }, { status: 403 });
    mocks.requireTopAdminRole.mockRejectedValue(error);
    mocks.authzErrorResponse.mockReturnValue(authzResponse);

    const request = makePatchRequest("window-1", { title: "test" });

    const response = await PATCH(request, makeParams("window-1"));

    expect(response.status).toBe(403);
    expect(mocks.maintenanceWindowFindUnique).not.toHaveBeenCalled();
  });

  it("returns 500 when transaction fails", async () => {
    const error = new Error("database failed");
    mocks.transaction.mockRejectedValue(error);

    const request = makePatchRequest("window-1", { title: "test" });

    const response = await PATCH(request, makeParams("window-1"));

    expect(response.status).toBe(500);
    expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "管理者: メンテナンス期間の更新に失敗しました",
      { error: "Error: database failed" },
    );
  });
});

describe("DELETE /api/admin/maintenance/[id]", () => {
  it("deletes a maintenance window successfully", async () => {
    const request = new Request(
      "http://localhost/api/admin/maintenance/window-1",
      { method: "DELETE" },
    );

    const response = await DELETE(request, makeParams("window-1"));

    expect(response.status).toBe(200);
    expect(await expectJson(response)).toEqual({ id: "window-1" });
    expect(mocks.requireTopAdminRole).toHaveBeenCalledTimes(1);
    expect(mocks.maintenanceWindowFindUnique).toHaveBeenCalledWith({
      where: { id: "window-1" },
      select: { id: true },
    });
    expect(mocks.maintenanceWindowDelete).toHaveBeenCalledWith({
      where: { id: "window-1" },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      {
        actorUserId: "admin-1",
        action: "maintenance_window.delete",
        resource: "maintenance_window",
        resourceId: "window-1",
        detail: {},
      },
      {
        maintenanceWindow: {
          update: mocks.maintenanceWindowUpdate,
          delete: mocks.maintenanceWindowDelete,
        },
      },
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith("メンテナンス期間を削除しました", {
      actorId: "admin-1",
      windowId: "window-1",
    });
  });

  it("returns 404 when window does not exist", async () => {
    mocks.maintenanceWindowFindUnique.mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/admin/maintenance/no-such-id",
      { method: "DELETE" },
    );

    const response = await DELETE(request, makeParams("no-such-id"));

    expect(response.status).toBe(404);
    expect(await expectJson(response)).toEqual({ error: "Not Found" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns authorization error", async () => {
    const error = new Error("Forbidden");
    const authzResponse = Response.json({ error: "Forbidden" }, { status: 403 });
    mocks.requireTopAdminRole.mockRejectedValue(error);
    mocks.authzErrorResponse.mockReturnValue(authzResponse);

    const request = new Request(
      "http://localhost/api/admin/maintenance/window-1",
      { method: "DELETE" },
    );

    const response = await DELETE(request, makeParams("window-1"));

    expect(response.status).toBe(403);
    expect(mocks.maintenanceWindowFindUnique).not.toHaveBeenCalled();
  });

  it("returns 500 when transaction fails", async () => {
    const error = new Error("database failed");
    mocks.transaction.mockRejectedValue(error);

    const request = new Request(
      "http://localhost/api/admin/maintenance/window-1",
      { method: "DELETE" },
    );

    const response = await DELETE(request, makeParams("window-1"));

    expect(response.status).toBe(500);
    expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "管理者: メンテナンス期間の削除に失敗しました",
      { error: "Error: database failed" },
    );
  });
});
