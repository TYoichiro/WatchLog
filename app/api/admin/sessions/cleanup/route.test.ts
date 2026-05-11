import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  authzErrorResponse: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  requireTopAdminRole: vi.fn(),
  sessionDeleteMany: vi.fn(),
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
    $transaction: mocks.transaction,
  },
}));

const actor = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@example.com",
  image: null,
};

const now = new Date("2026-05-11T05:00:00.000Z");

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();

  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.requireTopAdminRole.mockResolvedValue(actor);
  mocks.sessionDeleteMany.mockResolvedValue({ count: 2 });
  mocks.transaction.mockImplementation(
    async (
      callback: (tx: {
        session: {
          deleteMany: typeof mocks.sessionDeleteMany;
        };
      }) => Promise<unknown>,
    ) =>
      callback({
        session: {
          deleteMany: mocks.sessionDeleteMany,
        },
      }),
  );
  mocks.writeAuditLog.mockResolvedValue({
    id: "audit-1",
    createdAt: now,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/admin/sessions/cleanup", () => {
  it("deletes expired sessions and writes an audit log", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(await expectJson(response)).toEqual({
      deletedCount: 2,
      expiredBefore: "2026-05-11T14:00:00.000+09:00",
    });
    expect(mocks.requireTopAdminRole).toHaveBeenCalledTimes(1);
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({
      where: {
        expires: {
          lt: now,
        },
      },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      {
        actorUserId: "admin-1",
        action: "session.cleanup_expired",
        resource: "session",
        detail: {
          deletedCount: 2,
          expiredBefore: "2026-05-11T14:00:00.000+09:00",
        },
      },
      {
        session: {
          deleteMany: mocks.sessionDeleteMany,
        },
      },
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith("Expired sessions cleaned up", {
      actorId: "admin-1",
      deletedCount: 2,
      expiredBefore: "2026-05-11T14:00:00.000+09:00",
    });
  });

  it("returns authorization errors without deleting sessions", async () => {
    const error = new Error("Forbidden");
    const authzResponse = Response.json({ error: "Forbidden" }, { status: 403 });
    mocks.requireTopAdminRole.mockRejectedValue(error);
    mocks.authzErrorResponse.mockReturnValue(authzResponse);

    const response = await POST();

    expect(response.status).toBe(403);
    expect(await expectJson(response)).toEqual({ error: "Forbidden" });
    expect(mocks.authzErrorResponse).toHaveBeenCalledWith(error);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.sessionDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 500 when cleanup fails", async () => {
    const error = new Error("database failed");
    mocks.transaction.mockRejectedValue(error);

    const response = await POST();

    expect(response.status).toBe(500);
    expect(await expectJson(response)).toEqual({ error: "Internal Server Error" });
    expect(mocks.loggerError).toHaveBeenCalledWith("Expired session cleanup failed", {
      error: "Error: database failed",
    });
  });
});
