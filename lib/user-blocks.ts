import { auth } from "@/auth";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { prisma } from "@/lib/prisma";
import { DEVELOPER_USER_ID } from "@/lib/showroom-users";
import type { UserBlockData } from "@/types/api/blocks";

export type { UserBlockData };

type SaveUserBlockInput = {
  blockedUserId: string;
  blockedUserName: string;
};

const userBlockSelect = {
  id: true,
  blockedShowroomUserId: true,
  blockedShowroomUserName: true,
  createdAt: true,
  updatedAt: true,
} as const;

type SelectedUserBlock = {
  id: string;
  blockedShowroomUserId: string;
  blockedShowroomUserName: string;
  createdAt: Date;
  updatedAt: Date;
};

export class DeveloperBlockForbiddenError extends Error {
  readonly status = 403;

  constructor() {
    super("Developer user cannot be blocked");
    this.name = "DeveloperBlockForbiddenError";
  }
}

function toUserBlockData(block: SelectedUserBlock): UserBlockData {
  return {
    id: block.id,
    blockedUserId: block.blockedShowroomUserId,
    blockedUserName: block.blockedShowroomUserName,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  };
}

export function serializeUserBlock(block: UserBlockData) {
  return {
    id: block.id,
    blockedUserId: block.blockedUserId,
    blockedUserName: block.blockedUserName,
    createdAt: toJstWallTimeIsoString(block.createdAt),
    updatedAt: toJstWallTimeIsoString(block.updatedAt),
  };
}

export async function listUserBlocks(userId: string): Promise<UserBlockData[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerUserId: userId },
    orderBy: { createdAt: "desc" },
    select: userBlockSelect,
  });

  return blocks.map(toUserBlockData);
}

export async function listBlockedShowroomUserIds(
  userId: string
): Promise<string[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerUserId: userId },
    select: {
      blockedShowroomUserId: true,
    },
  });

  return blocks.map((block) => block.blockedShowroomUserId);
}

export async function getOptionalBlockedUserIds(): Promise<Set<string>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Set<string>();
  return new Set(await listBlockedShowroomUserIds(userId));
}

export async function createUserBlock(
  userId: string,
  input: SaveUserBlockInput
): Promise<UserBlockData> {
  if (input.blockedUserId === DEVELOPER_USER_ID) {
    throw new DeveloperBlockForbiddenError();
  }

  const block = await prisma.userBlock.upsert({
    where: {
      blockerUserId_blockedShowroomUserId: {
        blockerUserId: userId,
        blockedShowroomUserId: input.blockedUserId,
      },
    },
    update: {
      blockedShowroomUserName: input.blockedUserName,
    },
    create: {
      blockerUserId: userId,
      blockedShowroomUserId: input.blockedUserId,
      blockedShowroomUserName: input.blockedUserName,
    },
    select: userBlockSelect,
  });

  return toUserBlockData(block);
}

export async function deleteUserBlock(
  userId: string,
  blockId: string
): Promise<boolean> {
  const result = await prisma.userBlock.deleteMany({
    where: {
      id: blockId,
      blockerUserId: userId,
    },
  });

  return result.count > 0;
}
