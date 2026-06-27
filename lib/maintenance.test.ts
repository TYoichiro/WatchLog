import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maintenanceWindowFindMany: vi.fn(),
  maintenanceWindowFindFirst: vi.fn(),
  toJstWallTimeDate: vi.fn(() => new Date("2026-06-01T03:00:00.000Z")),
  formatJstWallDateTime: vi.fn(
    (_date: Date, _opts: Intl.DateTimeFormatOptions) => "2026/06/01 12:00"
  ),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    maintenanceWindow: {
      findMany: mocks.maintenanceWindowFindMany,
      findFirst: mocks.maintenanceWindowFindFirst,
    },
  },
}));

vi.mock("@/lib/jst", () => ({
  toJstWallTimeDate: mocks.toJstWallTimeDate,
  formatJstWallDateTime: mocks.formatJstWallDateTime,
}));

import { getActiveMaintenanceWindow, listAllMaintenanceWindows } from "./maintenance";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.toJstWallTimeDate.mockReturnValue(new Date("2026-06-01T03:00:00.000Z"));
  mocks.formatJstWallDateTime.mockReturnValue("2026/06/01 12:00");
});

const makeWindow = (overrides: Record<string, unknown> = {}) => ({
  id: "mw-1",
  title: "メンテナンス",
  message: "メンテ中です",
  startsAt: new Date("2026-06-01T03:00:00.000Z"),
  endsAt: new Date("2026-06-01T06:00:00.000Z"),
  isEnabled: true,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-01T00:00:00.000Z"),
  ...overrides,
});

describe("listAllMaintenanceWindows", () => {
  it("DB の全メンテナンスウィンドウを返す", async () => {
    mocks.maintenanceWindowFindMany.mockResolvedValue([makeWindow()]);
    const result = await listAllMaintenanceWindows();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("mw-1");
  });

  it("空の場合は空配列を返す", async () => {
    mocks.maintenanceWindowFindMany.mockResolvedValue([]);
    const result = await listAllMaintenanceWindows();
    expect(result).toHaveLength(0);
  });

  it("startsAt 降順でクエリする", async () => {
    mocks.maintenanceWindowFindMany.mockResolvedValue([]);
    await listAllMaintenanceWindows();
    const call = mocks.maintenanceWindowFindMany.mock.calls[0][0];
    expect(call.orderBy).toEqual(
      expect.arrayContaining([{ startsAt: "desc" }])
    );
  });
});

describe("getActiveMaintenanceWindow", () => {
  it("アクティブなウィンドウが存在する場合は period を付与して返す", async () => {
    mocks.maintenanceWindowFindFirst.mockResolvedValue(makeWindow());

    const result = await getActiveMaintenanceWindow();

    expect(result).not.toBeNull();
    expect(result!.id).toBe("mw-1");
    expect(typeof result!.period).toBe("string");
    expect(result!.period).toContain("〜");
  });

  it("アクティブなウィンドウがない場合は null を返す", async () => {
    mocks.maintenanceWindowFindFirst.mockResolvedValue(null);
    const result = await getActiveMaintenanceWindow();
    expect(result).toBeNull();
  });

  it("クエリの where 条件に isEnabled: true が含まれる", async () => {
    mocks.maintenanceWindowFindFirst.mockResolvedValue(null);
    await getActiveMaintenanceWindow();
    const call = mocks.maintenanceWindowFindFirst.mock.calls[0][0];
    expect(call.where.isEnabled).toBe(true);
  });

  it("now 引数を渡すと toJstWallTimeDate の代わりに使われる", async () => {
    const customNow = new Date("2026-12-01T00:00:00.000Z");
    mocks.maintenanceWindowFindFirst.mockResolvedValue(null);

    await getActiveMaintenanceWindow(customNow);

    expect(mocks.maintenanceWindowFindFirst).toHaveBeenCalled();
    const call = mocks.maintenanceWindowFindFirst.mock.calls[0][0];
    expect(call.where.startsAt).toMatchObject({ lte: customNow });
    expect(call.where.endsAt).toMatchObject({ gt: customNow });
  });

  it("message が null のウィンドウも返す", async () => {
    mocks.maintenanceWindowFindFirst.mockResolvedValue(makeWindow({ message: null }));
    const result = await getActiveMaintenanceWindow();
    expect(result!.message).toBeNull();
  });
});
