import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userRegisteredRoomFindMany: vi.fn(),
  userRegisteredRoomFindUnique: vi.fn(),
  userRegisteredRoomFindFirst: vi.fn(),
  userRegisteredRoomUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userRegisteredRoom: {
      findMany: mocks.userRegisteredRoomFindMany,
      findUnique: mocks.userRegisteredRoomFindUnique,
      findFirst: mocks.userRegisteredRoomFindFirst,
      upsert: mocks.userRegisteredRoomUpsert,
    },
  },
}));

import {
  getRegisteredRoomOwner,
  getUserRegisteredRoom,
  listAllRegisteredRooms,
  saveUserRegisteredRoom,
} from "./user-registered-room";

beforeEach(() => {
  vi.clearAllMocks();
});

const makeDbRoom = (overrides: Record<string, unknown> = {}) => ({
  id: "room-1",
  roomId: "12345",
  roomUrl: "test-room",
  roomName: "テストルーム",
  imageUrl: "https://example.com/img.jpg",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  user: {
    id: "user-1",
    name: "テストユーザー",
    userRoles: [],
  },
  ...overrides,
});

describe("listAllRegisteredRooms", () => {
  it("登録ルーム一覧を返す", async () => {
    mocks.userRegisteredRoomFindMany.mockResolvedValue([makeDbRoom()]);
    const result = await listAllRegisteredRooms();
    expect(result).toHaveLength(1);
    expect(result[0].roomId).toBe("12345");
  });

  it("isPremium / isAdmin を userRoles から導出する", async () => {
    mocks.userRegisteredRoomFindMany.mockResolvedValue([
      makeDbRoom({
        user: {
          id: "user-1",
          name: "Admin",
          userRoles: [{ id: "r1", role: { name: "admin" } }],
        },
      }),
    ]);
    const result = await listAllRegisteredRooms();
    expect(result[0].user.isAdmin).toBe(true);
    expect(result[0].user.isPremium).toBe(false);
  });

  it("premium ロールを正しく判定する", async () => {
    mocks.userRegisteredRoomFindMany.mockResolvedValue([
      makeDbRoom({
        user: {
          id: "user-1",
          name: "Premium",
          userRoles: [{ id: "r1", role: { name: "premiumuser" } }],
        },
      }),
    ]);
    const result = await listAllRegisteredRooms();
    expect(result[0].user.isPremium).toBe(true);
    expect(result[0].user.isAdmin).toBe(false);
  });

  it("空の場合は空配列を返す", async () => {
    mocks.userRegisteredRoomFindMany.mockResolvedValue([]);
    expect(await listAllRegisteredRooms()).toHaveLength(0);
  });
});

describe("getUserRegisteredRoom", () => {
  it("ユーザーのルームを返す", async () => {
    mocks.userRegisteredRoomFindUnique.mockResolvedValue({
      roomId: "12345",
      roomUrl: "test-room",
      roomName: "テストルーム",
      imageUrl: null,
    });
    const result = await getUserRegisteredRoom("user-1");
    expect(result).not.toBeNull();
    expect(result!.roomId).toBe("12345");
  });

  it("登録がない場合は null を返す", async () => {
    mocks.userRegisteredRoomFindUnique.mockResolvedValue(null);
    expect(await getUserRegisteredRoom("user-1")).toBeNull();
  });
});

describe("getRegisteredRoomOwner", () => {
  it("他ユーザーが登録したルームを返す", async () => {
    mocks.userRegisteredRoomFindFirst.mockResolvedValue({ userId: "user-2" });
    const result = await getRegisteredRoomOwner("user-1", "12345", "test-room");
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-2");
  });

  it("同じルームが他ユーザーに登録されていない場合は null を返す", async () => {
    mocks.userRegisteredRoomFindFirst.mockResolvedValue(null);
    expect(await getRegisteredRoomOwner("user-1", "12345", "test-room")).toBeNull();
  });

  it("where に userId: { not: userId } が含まれる", async () => {
    mocks.userRegisteredRoomFindFirst.mockResolvedValue(null);
    await getRegisteredRoomOwner("user-1", "12345", "test-room");
    const call = mocks.userRegisteredRoomFindFirst.mock.calls[0][0];
    expect(call.where.userId).toMatchObject({ not: "user-1" });
  });
});

describe("saveUserRegisteredRoom", () => {
  it("upsert を呼んで結果を返す", async () => {
    mocks.userRegisteredRoomUpsert.mockResolvedValue({
      roomId: "12345",
      roomUrl: "test-room",
      roomName: "テストルーム",
      imageUrl: null,
    });

    const result = await saveUserRegisteredRoom("user-1", {
      roomId: "12345",
      roomUrl: "test-room",
    });

    expect(result.roomId).toBe("12345");
    expect(mocks.userRegisteredRoomUpsert).toHaveBeenCalledOnce();
  });

  it("inviteCodeId が undefined の場合は upsert data に含まれない", async () => {
    mocks.userRegisteredRoomUpsert.mockResolvedValue({
      roomId: "r",
      roomUrl: "u",
      roomName: null,
      imageUrl: null,
    });

    await saveUserRegisteredRoom("user-1", { roomId: "r", roomUrl: "u" });
    const call = mocks.userRegisteredRoomUpsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty("inviteCodeId");
    expect(call.create).not.toHaveProperty("inviteCodeId");
  });

  it("inviteCodeId が指定された場合は data に含まれる", async () => {
    mocks.userRegisteredRoomUpsert.mockResolvedValue({
      roomId: "r",
      roomUrl: "u",
      roomName: null,
      imageUrl: null,
    });

    await saveUserRegisteredRoom("user-1", {
      roomId: "r",
      roomUrl: "u",
      inviteCodeId: "inv-1",
    });

    const call = mocks.userRegisteredRoomUpsert.mock.calls[0][0];
    expect(call.update.inviteCodeId).toBe("inv-1");
    expect(call.create.inviteCodeId).toBe("inv-1");
  });

  it("カスタム client を渡せる", async () => {
    const customUpsert = vi.fn().mockResolvedValue({
      roomId: "r",
      roomUrl: "u",
      roomName: null,
      imageUrl: null,
    });
    const customClient = { userRegisteredRoom: { upsert: customUpsert } };

    await saveUserRegisteredRoom(
      "user-1",
      { roomId: "r", roomUrl: "u" },
      customClient as never
    );

    expect(mocks.userRegisteredRoomUpsert).not.toHaveBeenCalled();
    expect(customUpsert).toHaveBeenCalledOnce();
  });
});
