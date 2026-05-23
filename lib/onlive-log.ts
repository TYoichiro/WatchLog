import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";

type OnliveLogClient =
  | Pick<PrismaClient, "onliveLog">
  | Pick<Prisma.TransactionClient, "onliveLog">;

export type SaveOnliveLogInput = {
  capturedAt: Date;
  liveId: string;
  log: Prisma.InputJsonValue;
  roomId: string;
};

export type OnliveLogListItem = {
  capturedAt: Date;
  commentCount: number;
  createdAt: Date;
  giftCount: number;
  id: string;
  isFavorite: boolean;
  liveId: string;
  liveRankingCount: number;
  roomId: string;
  roomName: string | null;
  title: string | null;
  totalRankingCount: number;
  updatedAt: Date;
};

export type OnliveLogDetail = {
  capturedAt: Date;
  createdAt: Date;
  id: string;
  liveId: string;
  liveStartedAt: number | null;
  log: Record<string, unknown>;
  room: {
    imageUrl: string | null;
    roomId: string;
    roomName: string | null;
    roomUrl: string;
  } | null;
  roomId: string;
  updatedAt: Date;
};

function getJsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function getJsonNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getLogLiveStartedAt(log: Prisma.JsonValue): number | null {
  const record = getJsonRecord(log);
  const liveInfo = getRecord(record.liveInfo);

  return getJsonNumber(liveInfo?.startedAt);
}

function getLogSummaryCounts(log: Prisma.JsonValue) {
  const record = getJsonRecord(log);
  const rankings = getRecord(record.rankings);

  return {
    commentCount: getArrayLength(record.comments),
    giftCount: getArrayLength(record.gifts),
    liveRankingCount: getArrayLength(rankings?.live),
    totalRankingCount: getArrayLength(rankings?.total),
  };
}

export async function saveOnliveLog(
  input: SaveOnliveLogInput,
  client: OnliveLogClient = prisma
) {
  return client.onliveLog.upsert({
    where: {
      roomId_liveId_capturedAt: {
        roomId: input.roomId,
        liveId: input.liveId,
        capturedAt: input.capturedAt,
      },
    },
    update: {
      log: input.log,
    },
    create: {
      roomId: input.roomId,
      liveId: input.liveId,
      capturedAt: input.capturedAt,
      log: input.log,
    },
    select: {
      id: true,
      capturedAt: true,
      updatedAt: true,
    },
  });
}

export async function listUserOnliveLogs(
  userId: string
): Promise<OnliveLogListItem[]> {
  const registeredRoom = await getUserRegisteredRoom(userId);

  if (!registeredRoom) {
    return [];
  }

  const [logs, favorites] = await Promise.all([
    prisma.onliveLog.findMany({
      where: {
        isDeleted: false,
        roomId: registeredRoom.roomId,
      },
      orderBy: {
        capturedAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        roomId: true,
        liveId: true,
        capturedAt: true,
        createdAt: true,
        updatedAt: true,
        log: true,
        title: true,
      },
    }),
    prisma.onliveLogFavorite.findMany({
      where: { userId },
      select: { logId: true },
    }),
  ]);

  const favoriteSet = new Set(favorites.map((f) => f.logId));

  return logs.map((log) => ({
    ...log,
    ...getLogSummaryCounts(log.log),
    isFavorite: favoriteSet.has(log.id),
    roomName: registeredRoom.roomName,
  }));
}

export async function listAllOnliveLogs(userId?: string): Promise<OnliveLogListItem[]> {
  const [logs, registeredRooms, favorites] = await Promise.all([
    prisma.onliveLog.findMany({
      where: { isDeleted: false },
      orderBy: { capturedAt: "desc" },
      take: 500,
      select: {
        id: true,
        roomId: true,
        liveId: true,
        capturedAt: true,
        createdAt: true,
        updatedAt: true,
        log: true,
        title: true,
      },
    }),
    prisma.userRegisteredRoom.findMany({
      select: { roomId: true, roomName: true },
    }),
    userId
      ? prisma.onliveLogFavorite.findMany({
          where: { userId },
          select: { logId: true },
        })
      : Promise.resolve([]),
  ]);

  const roomNameMap = new Map(
    registeredRooms.map((r) => [r.roomId, r.roomName])
  );
  const favoriteSet = new Set(favorites.map((f) => f.logId));

  return logs.map((log) => ({
    ...log,
    ...getLogSummaryCounts(log.log),
    isFavorite: favoriteSet.has(log.id),
    roomName: roomNameMap.get(log.roomId) ?? null,
  }));
}

export async function getAnyOnliveLog(
  logId: string
): Promise<OnliveLogDetail | null> {
  const log = await prisma.onliveLog.findFirst({
    where: { id: logId, isDeleted: false },
    select: {
      id: true,
      roomId: true,
      liveId: true,
      capturedAt: true,
      createdAt: true,
      updatedAt: true,
      log: true,
    },
  });

  if (!log) {
    return null;
  }

  const registeredRoom = await prisma.userRegisteredRoom.findFirst({
    where: { roomId: log.roomId },
    select: { roomId: true, roomName: true, roomUrl: true, imageUrl: true },
  });

  return {
    ...log,
    liveStartedAt: getLogLiveStartedAt(log.log),
    log: getJsonRecord(log.log),
    room: registeredRoom ?? null,
  };
}

export async function getUserOnliveLog(
  userId: string,
  logId: string
): Promise<OnliveLogDetail | null> {
  const registeredRoom = await getUserRegisteredRoom(userId);

  if (!registeredRoom) {
    return null;
  }

  const log = await prisma.onliveLog.findFirst({
    where: {
      id: logId,
      isDeleted: false,
      roomId: registeredRoom.roomId,
    },
    select: {
      id: true,
      roomId: true,
      liveId: true,
      capturedAt: true,
      createdAt: true,
      updatedAt: true,
      log: true,
    },
  });

  if (!log) {
    return null;
  }

  return {
    ...log,
    liveStartedAt: getLogLiveStartedAt(log.log),
    log: getJsonRecord(log.log),
    room: registeredRoom,
  };
}

export async function updateOnliveLogTitle(
  userId: string,
  logId: string,
  title: string | null,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) {
    const result = await prisma.onliveLog.updateMany({
      where: { id: logId, isDeleted: false },
      data: { title },
    });
    return result.count > 0;
  }

  const registeredRoom = await getUserRegisteredRoom(userId);
  if (!registeredRoom) return false;

  const result = await prisma.onliveLog.updateMany({
    where: { id: logId, isDeleted: false, roomId: registeredRoom.roomId },
    data: { title },
  });
  return result.count > 0;
}

export async function toggleOnliveLogFavorite(
  userId: string,
  logId: string,
  isAdmin: boolean
): Promise<boolean> {
  if (!isAdmin) {
    const registeredRoom = await getUserRegisteredRoom(userId);
    if (!registeredRoom) return false;

    const log = await prisma.onliveLog.findUnique({
      where: { id: logId },
      select: { roomId: true },
    });
    if (!log || log.roomId !== registeredRoom.roomId) return false;
  }

  const existing = await prisma.onliveLogFavorite.findUnique({
    where: { userId_logId: { userId, logId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.onliveLogFavorite.delete({
      where: { userId_logId: { userId, logId } },
    });
    return false;
  }

  await prisma.onliveLogFavorite.create({
    data: { userId, logId },
  });
  return true;
}

export async function deleteUserOnliveLog(
  userId: string,
  logId: string
): Promise<boolean> {
  const registeredRoom = await getUserRegisteredRoom(userId);

  if (!registeredRoom) {
    return false;
  }

  const result = await prisma.onliveLog.updateMany({
    where: {
      id: logId,
      isDeleted: false,
      roomId: registeredRoom.roomId,
    },
    data: {
      isDeleted: true,
    },
  });

  return result.count > 0;
}
