import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onliveLogUpsert: vi.fn(),
  onliveLogFindMany: vi.fn(),
  onliveLogFindFirst: vi.fn(),
  onliveLogFindUnique: vi.fn(),
  onliveLogUpdateMany: vi.fn(),
  onliveLogFavoriteFindMany: vi.fn(),
  onliveLogFavoriteFindUnique: vi.fn(),
  onliveLogFavoriteCreate: vi.fn(),
  onliveLogFavoriteDelete: vi.fn(),
  userRegisteredRoomFindMany: vi.fn(),
  getUserRegisteredRoom: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    onliveLog: {
      upsert: mocks.onliveLogUpsert,
      findMany: mocks.onliveLogFindMany,
      findFirst: mocks.onliveLogFindFirst,
      findUnique: mocks.onliveLogFindUnique,
      updateMany: mocks.onliveLogUpdateMany,
    },
    onliveLogFavorite: {
      findMany: mocks.onliveLogFavoriteFindMany,
      findUnique: mocks.onliveLogFavoriteFindUnique,
      create: mocks.onliveLogFavoriteCreate,
      delete: mocks.onliveLogFavoriteDelete,
    },
    userRegisteredRoom: {
      findMany: mocks.userRegisteredRoomFindMany,
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/user-registered-room", () => ({
  getUserRegisteredRoom: mocks.getUserRegisteredRoom,
}));

import {
  deleteUserOnliveLog,
  getAnyOnliveLog,
  getPreviousOnliveLog,
  getUserOnliveLog,
  listAllOnliveLogs,
  listUserOnliveLogs,
  saveOnliveLog,
  toggleOnliveLogFavorite,
  updateOnliveLogTitle,
} from "./onlive-log";

beforeEach(() => {
  vi.clearAllMocks();
});

const makeLog = (overrides: Record<string, unknown> = {}) => ({
  id: "log-1",
  roomId: "12345",
  liveId: "live-1",
  capturedAt: new Date("2026-06-01T12:00:00.000Z"),
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
  updatedAt: new Date("2026-06-01T12:00:00.000Z"),
  commentCount: 5,
  giftCount: 3,
  title: null,
  ...overrides,
});

// ---- saveOnliveLog ----

describe("saveOnliveLog", () => {
  it("onliveLog.upsert を呼ぶ", async () => {
    mocks.onliveLogUpsert.mockResolvedValue({
      id: "log-1",
      capturedAt: new Date(),
      updatedAt: new Date(),
    });

    await saveOnliveLog({
      capturedAt: new Date("2026-06-01T12:00:00.000Z"),
      liveId: "live-1",
      log: { comments: ["c1", "c2"], gifts: ["g1"] },
      roomId: "12345",
    });

    expect(mocks.onliveLogUpsert).toHaveBeenCalledOnce();
    const call = mocks.onliveLogUpsert.mock.calls[0][0];
    expect(call.create.commentCount).toBe(2);
    expect(call.create.giftCount).toBe(1);
  });

  it("log が配列でない場合は count が 0 になる", async () => {
    mocks.onliveLogUpsert.mockResolvedValue({ id: "l", capturedAt: new Date(), updatedAt: new Date() });

    await saveOnliveLog({
      capturedAt: new Date(),
      liveId: "live-1",
      log: { comments: "invalid", gifts: null },
      roomId: "12345",
    });

    const call = mocks.onliveLogUpsert.mock.calls[0][0];
    expect(call.create.commentCount).toBe(0);
    expect(call.create.giftCount).toBe(0);
  });
});

// ---- listUserOnliveLogs ----

describe("listUserOnliveLogs", () => {
  it("登録ルームがない場合は空配列を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue(null);
    expect(await listUserOnliveLogs("user-1")).toHaveLength(0);
  });

  it("ログ一覧を返す（お気に入りフラグ付き）", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue({
      roomId: "12345",
      roomName: "テスト",
      roomUrl: "test",
      imageUrl: null,
    });
    mocks.onliveLogFindMany.mockResolvedValue([makeLog()]);
    mocks.onliveLogFavoriteFindMany.mockResolvedValue([{ logId: "log-1" }]);

    const result = await listUserOnliveLogs("user-1");
    expect(result).toHaveLength(1);
    expect(result[0].isFavorite).toBe(true);
    expect(result[0].roomName).toBe("テスト");
  });

  it("お気に入りでないログは isFavorite: false", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue({
      roomId: "12345",
      roomName: null,
      roomUrl: "test",
      imageUrl: null,
    });
    mocks.onliveLogFindMany.mockResolvedValue([makeLog()]);
    mocks.onliveLogFavoriteFindMany.mockResolvedValue([]);

    const result = await listUserOnliveLogs("user-1");
    expect(result[0].isFavorite).toBe(false);
  });
});

// ---- listAllOnliveLogs ----

describe("listAllOnliveLogs", () => {
  it("全ログを roomName 付きで返す", async () => {
    mocks.onliveLogFindMany.mockResolvedValue([makeLog()]);
    mocks.userRegisteredRoomFindMany.mockResolvedValue([
      { roomId: "12345", roomName: "テストルーム" },
    ]);
    mocks.onliveLogFavoriteFindMany.mockResolvedValue([]);

    const result = await listAllOnliveLogs();
    expect(result).toHaveLength(1);
    expect(result[0].roomName).toBe("テストルーム");
  });

  it("userId 引数を渡すとお気に入りを取得する", async () => {
    mocks.onliveLogFindMany.mockResolvedValue([makeLog()]);
    mocks.userRegisteredRoomFindMany.mockResolvedValue([]);
    mocks.onliveLogFavoriteFindMany.mockResolvedValue([{ logId: "log-1" }]);

    const result = await listAllOnliveLogs("user-1");
    expect(result[0].isFavorite).toBe(true);
  });

  it("登録ルームに対応しない roomId は roomName が null", async () => {
    mocks.onliveLogFindMany.mockResolvedValue([makeLog({ roomId: "unknown" })]);
    mocks.userRegisteredRoomFindMany.mockResolvedValue([]);
    mocks.onliveLogFavoriteFindMany.mockResolvedValue([]);

    const result = await listAllOnliveLogs();
    expect(result[0].roomName).toBeNull();
  });
});

// ---- getAnyOnliveLog ----

describe("getAnyOnliveLog", () => {
  it("ログが存在する場合は詳細を返す", async () => {
    mocks.onliveLogFindFirst.mockResolvedValue({
      ...makeLog(),
      log: { liveInfo: { startedAt: 1000 }, comments: [], gifts: [] },
    });
    vi.mocked(
      (await import("@/lib/prisma")).prisma.userRegisteredRoom.findFirst
    ).mockResolvedValue(null);

    const result = await getAnyOnliveLog("log-1");
    expect(result).not.toBeNull();
    expect(result!.liveStartedAt).toBe(1000);
  });

  it("ログが存在しない場合は null を返す", async () => {
    mocks.onliveLogFindFirst.mockResolvedValue(null);
    expect(await getAnyOnliveLog("log-1")).toBeNull();
  });
});

// ---- getUserOnliveLog ----

describe("getUserOnliveLog", () => {
  it("登録ルームがない場合は null を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue(null);
    expect(await getUserOnliveLog("user-1", "log-1")).toBeNull();
  });

  it("ログが存在しない場合は null を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue({
      roomId: "12345",
      roomName: null,
      roomUrl: "t",
      imageUrl: null,
    });
    mocks.onliveLogFindFirst.mockResolvedValue(null);
    expect(await getUserOnliveLog("user-1", "log-1")).toBeNull();
  });

  it("ログが見つかった場合は詳細を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue({
      roomId: "12345",
      roomName: "テスト",
      roomUrl: "test",
      imageUrl: null,
    });
    mocks.onliveLogFindFirst.mockResolvedValue({
      ...makeLog(),
      log: {},
    });

    const result = await getUserOnliveLog("user-1", "log-1");
    expect(result).not.toBeNull();
    expect(result!.room?.roomId).toBe("12345");
  });
});

// ---- getPreviousOnliveLog ----

describe("getPreviousOnliveLog", () => {
  it("1 つ前のログを返す", async () => {
    const capturedAt = new Date("2026-06-01T12:00:00.000Z");
    mocks.onliveLogFindFirst.mockResolvedValue({
      capturedAt: new Date("2026-06-01T11:00:00.000Z"),
      log: { comments: [] },
    });

    const result = await getPreviousOnliveLog("12345", capturedAt);
    expect(result).not.toBeNull();
  });

  it("前のログがない場合は null を返す", async () => {
    mocks.onliveLogFindFirst.mockResolvedValue(null);
    const result = await getPreviousOnliveLog("12345", new Date());
    expect(result).toBeNull();
  });
});

// ---- updateOnliveLogTitle ----

describe("updateOnliveLogTitle", () => {
  it("admin の場合は roomId なしで更新する", async () => {
    mocks.onliveLogUpdateMany.mockResolvedValue({ count: 1 });
    const result = await updateOnliveLogTitle("user-1", "log-1", "タイトル", true);
    expect(result).toBe(true);
    const call = mocks.onliveLogUpdateMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("roomId");
  });

  it("一般ユーザーで登録ルームがない場合は false を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue(null);
    expect(await updateOnliveLogTitle("user-1", "log-1", "タイトル", false)).toBe(false);
  });

  it("一般ユーザーで更新成功した場合は true を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue({
      roomId: "12345",
      roomName: null,
      roomUrl: "t",
      imageUrl: null,
    });
    mocks.onliveLogUpdateMany.mockResolvedValue({ count: 1 });
    const result = await updateOnliveLogTitle("user-1", "log-1", "タイトル", false);
    expect(result).toBe(true);
  });
});

// ---- toggleOnliveLogFavorite ----

describe("toggleOnliveLogFavorite", () => {
  it("お気に入り登録されている場合は削除して false を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue({
      roomId: "12345",
      roomName: null,
      roomUrl: "t",
      imageUrl: null,
    });
    mocks.onliveLogFindUnique.mockResolvedValue({ roomId: "12345" });
    mocks.onliveLogFavoriteFindUnique.mockResolvedValue({ id: "fav-1" });
    mocks.onliveLogFavoriteDelete.mockResolvedValue({});

    const result = await toggleOnliveLogFavorite("user-1", "log-1", false);
    expect(result).toBe(false);
    expect(mocks.onliveLogFavoriteDelete).toHaveBeenCalledOnce();
  });

  it("お気に入り未登録の場合は作成して true を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue({
      roomId: "12345",
      roomName: null,
      roomUrl: "t",
      imageUrl: null,
    });
    mocks.onliveLogFindUnique.mockResolvedValue({ roomId: "12345" });
    mocks.onliveLogFavoriteFindUnique.mockResolvedValue(null);
    mocks.onliveLogFavoriteCreate.mockResolvedValue({});

    const result = await toggleOnliveLogFavorite("user-1", "log-1", false);
    expect(result).toBe(true);
    expect(mocks.onliveLogFavoriteCreate).toHaveBeenCalledOnce();
  });
});

// ---- deleteUserOnliveLog ----

describe("deleteUserOnliveLog", () => {
  it("admin の場合は roomId 条件なしで論理削除する", async () => {
    mocks.onliveLogUpdateMany.mockResolvedValue({ count: 1 });
    const result = await deleteUserOnliveLog("user-1", "log-1", true);
    expect(result).toBe(true);
  });

  it("admin でなく登録ルームがない場合は false を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue(null);
    expect(await deleteUserOnliveLog("user-1", "log-1")).toBe(false);
  });

  it("一般ユーザーで削除成功した場合は true を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue({
      roomId: "12345",
      roomName: null,
      roomUrl: "t",
      imageUrl: null,
    });
    mocks.onliveLogUpdateMany.mockResolvedValue({ count: 1 });
    const result = await deleteUserOnliveLog("user-1", "log-1");
    expect(result).toBe(true);
  });

  it("対象が見つからない場合は false を返す", async () => {
    mocks.getUserRegisteredRoom.mockResolvedValue({
      roomId: "12345",
      roomName: null,
      roomUrl: "t",
      imageUrl: null,
    });
    mocks.onliveLogUpdateMany.mockResolvedValue({ count: 0 });
    expect(await deleteUserOnliveLog("user-1", "log-1")).toBe(false);
  });
});
