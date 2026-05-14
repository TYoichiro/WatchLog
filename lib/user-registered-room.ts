import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { PREMIUM_ROLE_NAME, TOP_ADMIN_ROLE_NAME } from "@/lib/authz";
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

export type RegisteredRoomListItem = {
  id: string;
  roomId: string;
  roomUrl: string;
  roomName: string | null;
  imageUrl: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    isPremium: boolean;
    isAdmin: boolean;
  };
};

export async function listAllRegisteredRooms(): Promise<RegisteredRoomListItem[]> {
  const rooms = await prisma.userRegisteredRoom.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      roomId: true,
      roomUrl: true,
      roomName: true,
      imageUrl: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          userRoles: {
            where: {
              role: { name: { in: [PREMIUM_ROLE_NAME, TOP_ADMIN_ROLE_NAME] } },
            },
            select: { id: true, role: { select: { name: true } } },
          },
        },
      },
    },
  });

  return rooms.map((room) => ({
    ...room,
    user: {
      id: room.user.id,
      name: room.user.name,
      isPremium: room.user.userRoles.some((r) => r.role.name === PREMIUM_ROLE_NAME),
      isAdmin: room.user.userRoles.some((r) => r.role.name === TOP_ADMIN_ROLE_NAME),
    },
  }));
}

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
