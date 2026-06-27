import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: mocks.auditLogCreate },
  },
}));

import { writeAuditLog } from "./audit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("writeAuditLog", () => {
  const base = {
    actorUserId: "user-1",
    action: "CREATE",
    resource: "Room",
    detail: { roomId: "r-1" },
  };

  it("prisma.auditLog.create を正しい引数で呼ぶ", async () => {
    mocks.auditLogCreate.mockResolvedValue({ id: "log-1", createdAt: new Date() });

    await writeAuditLog(base);

    expect(mocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "user-1",
          action: "CREATE",
          resource: "Room",
          resourceId: null,
          detail: { roomId: "r-1" },
        }),
        select: { id: true, createdAt: true },
      })
    );
  });

  it("resourceId を渡すと data に含まれる", async () => {
    mocks.auditLogCreate.mockResolvedValue({ id: "log-2", createdAt: new Date() });

    await writeAuditLog({ ...base, resourceId: "res-42" });

    const call = mocks.auditLogCreate.mock.calls[0][0];
    expect(call.data.resourceId).toBe("res-42");
  });

  it("resourceId が undefined の場合は null になる", async () => {
    mocks.auditLogCreate.mockResolvedValue({ id: "log-3", createdAt: new Date() });

    await writeAuditLog({ ...base, resourceId: undefined });

    const call = mocks.auditLogCreate.mock.calls[0][0];
    expect(call.data.resourceId).toBeNull();
  });

  it("actorUserId が null でも動作する", async () => {
    mocks.auditLogCreate.mockResolvedValue({ id: "log-4", createdAt: new Date() });

    await writeAuditLog({ ...base, actorUserId: null });

    const call = mocks.auditLogCreate.mock.calls[0][0];
    expect(call.data.actorUserId).toBeNull();
  });

  it("カスタム client を渡すと prisma の代わりに使われる", async () => {
    const customCreate = vi.fn().mockResolvedValue({ id: "log-5", createdAt: new Date() });
    const customClient = { auditLog: { create: customCreate } };

    await writeAuditLog(base, customClient as never);

    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
    expect(customCreate).toHaveBeenCalledOnce();
  });

  it("prisma.auditLog.create の戻り値をそのまま返す", async () => {
    const returnValue = { id: "log-6", createdAt: new Date("2026-01-01") };
    mocks.auditLogCreate.mockResolvedValue(returnValue);

    const result = await writeAuditLog(base);
    expect(result).toEqual(returnValue);
  });
});
