import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    roomUserLastComment: {
      findMany: mocks.findMany,
      upsert: mocks.upsert,
    },
    $transaction: mocks.transaction,
  },
}));

import { toJstWallTimeDate } from "./jst";
import {
  extractRoomUserCommentsFromLog,
  getRoomLastCommentMap,
  upsertRoomUserLastComments,
} from "./room-user-last-comment";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((ops: Promise<unknown>[]) =>
    Promise.all(ops)
  );
  mocks.upsert.mockImplementation((args: { create: unknown }) =>
    Promise.resolve(args.create)
  );
});

describe("upsertRoomUserLastComments", () => {
  it("コメントが0件のときは何もしない", async () => {
    await upsertRoomUserLastComments("room-1", []);

    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("同一ユーザーの複数コメントがある場合は最新の日時のみ書き込む", async () => {
    mocks.findMany.mockResolvedValue([]);

    await upsertRoomUserLastComments("room-1", [
      { userId: "u1", userName: "Alice", commentedAt: new Date("2026-08-01T00:00:00.000Z") },
      { userId: "u1", userName: "Alice", commentedAt: new Date("2026-08-10T00:00:00.000Z") },
      { userId: "u1", userName: "Alice", commentedAt: new Date("2026-08-05T00:00:00.000Z") },
    ]);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          lastCommentAt: new Date("2026-08-10T00:00:00.000Z"),
        }),
      })
    );
  });

  it("既存のlastCommentAtより古い日時しかない場合は更新しない", async () => {
    mocks.findMany.mockResolvedValue([
      { showroomUserId: "u1", lastCommentAt: new Date("2026-08-10T00:00:00.000Z") },
    ]);

    await upsertRoomUserLastComments("room-1", [
      { userId: "u1", userName: "Alice", commentedAt: new Date("2026-08-01T00:00:00.000Z") },
    ]);

    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("既存より新しい日時の場合は更新する", async () => {
    mocks.findMany.mockResolvedValue([
      { showroomUserId: "u1", lastCommentAt: new Date("2026-08-01T00:00:00.000Z") },
    ]);

    await upsertRoomUserLastComments("room-1", [
      { userId: "u1", userName: "Alice", commentedAt: new Date("2026-08-10T00:00:00.000Z") },
    ]);

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("既存レコードがないユーザーは新規作成する", async () => {
    mocks.findMany.mockResolvedValue([]);

    await upsertRoomUserLastComments("room-1", [
      { userId: "u2", userName: "Bob", commentedAt: new Date("2026-08-10T00:00:00.000Z") },
    ]);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roomId_showroomUserId: { roomId: "room-1", showroomUserId: "u2" } },
        create: {
          roomId: "room-1",
          showroomUserId: "u2",
          showroomUserName: "Bob",
          lastCommentAt: new Date("2026-08-10T00:00:00.000Z"),
        },
      })
    );
  });
});

describe("getRoomLastCommentMap", () => {
  it("showroomUserId をキーとした lastCommentAt のMapを返す", async () => {
    mocks.findMany.mockResolvedValue([
      { showroomUserId: "u1", lastCommentAt: new Date("2026-08-01T00:00:00.000Z") },
      { showroomUserId: "u2", lastCommentAt: new Date("2026-08-02T00:00:00.000Z") },
    ]);

    const map = await getRoomLastCommentMap("room-1");

    expect(map.get("u1")).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(map.get("u2")).toEqual(new Date("2026-08-02T00:00:00.000Z"));
    expect(map.size).toBe(2);
  });

  it("該当レコードがない場合は空のMapを返す", async () => {
    mocks.findMany.mockResolvedValue([]);

    const map = await getRoomLastCommentMap("room-1");

    expect(map.size).toBe(0);
  });
});

describe("extractRoomUserCommentsFromLog", () => {
  it("notice/telopやuserId・createdAtが無いコメントは除外する", () => {
    const result = extractRoomUserCommentsFromLog([
      { userId: "u1", name: "Alice", createdAt: 1700000000, notice: false, telop: false },
      { userId: "u2", name: "Bob", createdAt: 1700000001, notice: true, telop: false },
      { userId: "u3", name: "Carol", createdAt: 1700000002, notice: false, telop: true },
      { userId: null, name: "Guest", createdAt: 1700000003, notice: false, telop: false },
      { userId: "u4", name: "Dave", createdAt: null, notice: false, telop: false },
    ]);

    expect(result).toEqual([
      {
        userId: "u1",
        userName: "Alice",
        commentedAt: toJstWallTimeDate(new Date(1700000000 * 1000)),
      },
    ]);
  });

  it("配列でない値を渡した場合は空配列を返す", () => {
    expect(extractRoomUserCommentsFromLog(null)).toEqual([]);
    expect(extractRoomUserCommentsFromLog(undefined)).toEqual([]);
    expect(extractRoomUserCommentsFromLog("not-an-array")).toEqual([]);
  });
});
