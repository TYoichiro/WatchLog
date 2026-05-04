import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type UserRegisteredRoomData = {
  imageUrl: string | null;
  roomId: string;
  roomName: string | null;
  roomUrl: string;
};

type SaveUserRegisteredRoomInput = {
  imageUrl?: string | null;
  inviteCodeId?: string | null;
  roomId: string;
  roomName?: string | null;
  roomUrl: string;
};

type UserRegisteredRoomClient =
  | Pick<PrismaClient, "userRegisteredRoom">
  | Pick<Prisma.TransactionClient, "userRegisteredRoom">;

const registeredRoomSelect = {
  imageUrl: true,
  roomId: true,
  roomName: true,
  roomUrl: true,
} as const;

export async function getUserRegisteredRoom(
  userId: string
): Promise<UserRegisteredRoomData | null> {
  return prisma.userRegisteredRoom.findUnique({
    where: { userId },
    select: registeredRoomSelect,
  });
}

export async function getRegisteredRoomOwner(
  userId: string,
  roomId: string,
  roomUrl: string
): Promise<{ userId: string } | null> {
  return prisma.userRegisteredRoom.findFirst({
    where: {
      userId: {
        not: userId,
      },
      OR: [{ roomId }, { roomUrl }],
    },
    select: {
      userId: true,
    },
  });
}

export async function saveUserRegisteredRoom(
  userId: string,
  room: SaveUserRegisteredRoomInput,
  client: UserRegisteredRoomClient = prisma
): Promise<UserRegisteredRoomData> {
  const inviteCodeData =
    room.inviteCodeId !== undefined
      ? {
          inviteCodeId: room.inviteCodeId,
        }
      : {};

  return client.userRegisteredRoom.upsert({
    where: { userId },
    update: {
      imageUrl: room.imageUrl ?? null,
      ...inviteCodeData,
      roomId: room.roomId,
      roomName: room.roomName ?? null,
      roomUrl: room.roomUrl,
    },
    create: {
      imageUrl: room.imageUrl ?? null,
      ...inviteCodeData,
      roomId: room.roomId,
      roomName: room.roomName ?? null,
      roomUrl: room.roomUrl,
      userId,
    },
    select: registeredRoomSelect,
  });
}
