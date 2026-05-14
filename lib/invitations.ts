import { randomInt } from "node:crypto";

import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { toJstWallTimeDate } from "@/lib/jst";
import { prisma } from "@/lib/prisma";

const INVITATION_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const INVITATION_CODE_UNIQUE_RETRY_LIMIT = 10;

export const INVITATION_CODE_LENGTH = 10;
export const USER_INVITATION_CODE_LIMIT = 3;

type InvitationCodeClient =
  | Pick<PrismaClient, "invitationCode">
  | Pick<Prisma.TransactionClient, "invitationCode">;

export type UserInvitationCodeData = {
  code: string;
  isActive: boolean;
};

export class InvalidInvitationCodeError extends Error {
  readonly status = 422;

  constructor(message = "招待コードが無効です。") {
    super(message);
    this.name = "InvalidInvitationCodeError";
  }
}

export function normalizeInvitationCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const code = value.trim().toUpperCase();
  return code.length > 0 ? code : null;
}

export function isInvitationCodeFormatValid(code: string): boolean {
  return /^[A-Z0-9]{10}$/.test(code);
}

export function generateInvitationCode(): string {
  return Array.from({ length: INVITATION_CODE_LENGTH }, () =>
    INVITATION_CODE_ALPHABET[randomInt(INVITATION_CODE_ALPHABET.length)]
  ).join("");
}

export async function isInvitationCodeAvailable(
  value: unknown,
  client: InvitationCodeClient = prisma
): Promise<boolean> {
  const code = normalizeInvitationCode(value);

  if (!code || !isInvitationCodeFormatValid(code)) {
    return false;
  }

  const invitationCode = await client.invitationCode.findUnique({
    where: {
      code,
    },
    select: {
      isDeleted: true,
      usedAt: true,
      usedByUserId: true,
    },
  });

  return (
    invitationCode !== null &&
    !invitationCode.isDeleted &&
    invitationCode.usedAt === null &&
    invitationCode.usedByUserId === null
  );
}

export async function consumeInvitationCode(
  value: unknown,
  userId: string,
  client: InvitationCodeClient
): Promise<{ code: string; id: string }> {
  const code = normalizeInvitationCode(value);

  if (!code || !isInvitationCodeFormatValid(code)) {
    throw new InvalidInvitationCodeError();
  }

  const invitationCode = await client.invitationCode.findUnique({
    where: {
      code,
    },
    select: {
      id: true,
      isDeleted: true,
      usedAt: true,
      usedByUserId: true,
    },
  });

  if (
    !invitationCode ||
    invitationCode.isDeleted ||
    invitationCode.usedAt !== null ||
    invitationCode.usedByUserId !== null
  ) {
    throw new InvalidInvitationCodeError();
  }

  const result = await client.invitationCode.updateMany({
    data: {
      isDeleted: true,
      usedAt: toJstWallTimeDate(),
      usedByUserId: userId,
    },
    where: {
      id: invitationCode.id,
      isDeleted: false,
      usedAt: null,
      usedByUserId: null,
    },
  });

  if (result.count !== 1) {
    throw new InvalidInvitationCodeError();
  }

  return {
    code,
    id: invitationCode.id,
  };
}

export async function ensureUserInvitationCodes(
  userId: string,
  client: InvitationCodeClient
): Promise<void> {
  const currentCount = await client.invitationCode.count({
    where: {
      inviterUserId: userId,
    },
  });
  const missingCount = USER_INVITATION_CODE_LIMIT - currentCount;

  for (let index = 0; index < missingCount; index += 1) {
    await createUniqueInvitationCode(userId, client);
  }
}

export async function addInvitationCode(
  inviterUserId: string
): Promise<UserInvitationCodeData> {
  const created = await createUniqueInvitationCode(inviterUserId, prisma);
  const invitation = await prisma.invitationCode.findUniqueOrThrow({
    where: { id: created!.id },
    select: { code: true },
  });
  return { code: invitation.code, isActive: true };
}

export async function listUserInvitationCodes(
  userId: string
): Promise<UserInvitationCodeData[]> {
  const invitationCodes = await prisma.invitationCode.findMany({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      code: true,
      isDeleted: true,
      usedAt: true,
    },
    where: {
      inviterUserId: userId,
    },
  });

  return invitationCodes.map((invitationCode) => ({
    code: invitationCode.code,
    isActive: !invitationCode.isDeleted && invitationCode.usedAt === null,
  }));
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function createUniqueInvitationCode(
  inviterUserId: string,
  client: InvitationCodeClient
) {
  for (let attempt = 0; attempt < INVITATION_CODE_UNIQUE_RETRY_LIMIT; attempt += 1) {
    try {
      return await client.invitationCode.create({
        data: {
          code: generateInvitationCode(),
          inviterUserId,
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Failed to generate a unique invitation code");
}
