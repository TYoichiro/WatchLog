import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  authzErrorResponse: vi.fn(),
  getUserRoles: vi.fn(),
  getAllOnliveLogsWithData: vi.fn(),
  getUserOnliveLogsWithData: vi.fn(),
  toJstWallTimeIsoString: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: mocks.requireUser,
  authzErrorResponse: mocks.authzErrorResponse,
  getUserRoles: mocks.getUserRoles,
  ForbiddenError: class ForbiddenError extends Error {
    readonly status = 403;
    constructor(message = "Forbidden") {
      super(message);
      this.name = "ForbiddenError";
    }
  },
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
  getAllOnliveLogsWithData: mocks.getAllOnliveLogsWithData,
  getUserOnliveLogsWithData: mocks.getUserOnliveLogsWithData,
}));

const user = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  image: null,
};

// UTC midnight → JST 09:00
const sampleLog = {
  capturedAt: new Date("2026-06-14T00:00:00.000Z"),
  liveId: "20260614",
  log: { comments: [], gifts: [] },
  roomId: "room-123",
};

const makeRequest = () =>
  new Request("http://localhost/api/onlive/logs/bulk-download");

async function getZipEntries(
  response: Response
): Promise<Record<string, unknown>> {
  const buffer = await response.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));
  return Object.fromEntries(
    Object.entries(unzipped).map(([name, data]) => [
      name,
      JSON.parse(strFromU8(data)),
    ])
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(user);
  mocks.authzErrorResponse.mockReturnValue(null);
  mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: true });
  mocks.getAllOnliveLogsWithData.mockResolvedValue([sampleLog]);
  mocks.getUserOnliveLogsWithData.mockResolvedValue([sampleLog]);
  mocks.toJstWallTimeIsoString.mockReturnValue("2026-06-14T09:00:00.000+09:00");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/onlive/logs/bulk-download", () => {
  it("未認証の場合は 401 を返す", async () => {
    mocks.requireUser.mockRejectedValue(new Error("Unauthorized"));
    mocks.authzErrorResponse.mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
  });

  it("admin でも premium でもない場合は 403 を返す", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: false });
    mocks.authzErrorResponse.mockImplementation((error: unknown) =>
      error instanceof Error && error.name === "ForbiddenError"
        ? Response.json({ error: "Forbidden" }, { status: 403 })
        : null
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    expect(mocks.getAllOnliveLogsWithData).not.toHaveBeenCalled();
    expect(mocks.getUserOnliveLogsWithData).not.toHaveBeenCalled();
  });

  it("管理者は getAllOnliveLogsWithData を呼ぶ", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: true, isPremium: false });

    await GET(makeRequest());

    expect(mocks.getAllOnliveLogsWithData).toHaveBeenCalledOnce();
    expect(mocks.getUserOnliveLogsWithData).not.toHaveBeenCalled();
  });

  it("プレミアムユーザーは getUserOnliveLogsWithData を userId で呼ぶ", async () => {
    mocks.getUserRoles.mockResolvedValue({ isAdmin: false, isPremium: true });

    await GET(makeRequest());

    expect(mocks.getUserOnliveLogsWithData).toHaveBeenCalledWith(user.id);
    expect(mocks.getAllOnliveLogsWithData).not.toHaveBeenCalled();
  });

  it("200 ステータスを返す", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
  });

  it("Content-Type が application/zip であること", async () => {
    const response = await GET(makeRequest());

    expect(response.headers.get("Content-Type")).toBe("application/zip");
  });

  it("Content-Disposition に attachment と .zip ファイル名が設定されること", async () => {
    const response = await GET(makeRequest());

    const disposition = response.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("watchlog-bulk-");
    expect(disposition).toContain(".zip");
  });

  it("ZIP ファイルにログ件数分のエントリが含まれること", async () => {
    const entries = await getZipEntries(await GET(makeRequest()));

    expect(Object.keys(entries)).toHaveLength(1);
  });

  it("ZIP 内の各 JSON が JsonViewerLog 形式（capturedAt・liveId・log・roomId）を持つこと", async () => {
    const entries = await getZipEntries(await GET(makeRequest()));
    const entry = Object.values(entries)[0] as {
      capturedAt: string;
      liveId: string;
      log: unknown;
      roomId: string;
    };

    expect(entry.capturedAt).toBe("2026-06-14T09:00:00.000+09:00");
    expect(entry.liveId).toBe("20260614");
    expect(entry.roomId).toBe("room-123");
    expect(entry.log).toBeDefined();
  });

  it("ZIP 内のファイル名に liveId と capturedAt 日時が含まれること", async () => {
    const entries = await getZipEntries(await GET(makeRequest()));
    const [filename] = Object.keys(entries);

    // capturedAt: 2026-06-14T00:00:00Z → JST 2026-06-14 09:00:00 → 20260614-090000
    expect(filename).toMatch(/^watchlog-20260614-20260614-090000\.json$/);
  });

  it("複数ログのとき ZIP にすべてのエントリが含まれること", async () => {
    const log2 = {
      capturedAt: new Date("2026-06-15T00:00:00.000Z"),
      liveId: "20260615",
      log: { comments: [1], gifts: [] },
      roomId: "room-123",
    };
    mocks.getUserOnliveLogsWithData.mockResolvedValue([sampleLog, log2]);
    mocks.toJstWallTimeIsoString
      .mockReturnValueOnce("2026-06-14T09:00:00.000+09:00")
      .mockReturnValueOnce("2026-06-15T09:00:00.000+09:00");

    const entries = await getZipEntries(await GET(makeRequest()));

    expect(Object.keys(entries)).toHaveLength(2);
  });

  it("ログが0件のときは空の ZIP を返す", async () => {
    mocks.getUserOnliveLogsWithData.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const entries = await getZipEntries(response);

    expect(response.status).toBe(200);
    expect(Object.keys(entries)).toHaveLength(0);
  });

  it("成功時にログを記録する", async () => {
    await GET(makeRequest());

    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "一括ダウンロードを実行しました",
      expect.objectContaining({
        userId: user.id,
        logCount: 1,
      })
    );
  });

  it("DB エラー時は 500 を返す", async () => {
    mocks.getUserOnliveLogsWithData.mockRejectedValue(new Error("DB error"));
    mocks.authzErrorResponse.mockReturnValue(null);

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "一括ダウンロードに失敗しました",
      expect.objectContaining({ error: expect.stringContaining("DB error") })
    );
  });
});
