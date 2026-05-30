import { NextRequest } from "next/server";

import { auth } from "@/auth";
import { hasTopAdminRole, PREMIUM_ROLE_NAME, TOP_ADMIN_ROLE_NAME } from "@/lib/authz";
import {
  consumeInvitationCode,
  ensureUserInvitationCodes,
  InvalidInvitationCodeError,
} from "@/lib/invitations";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  getRegisteredRoomOwner,
  getUserRegisteredRoom,
  saveUserRegisteredRoom,
} from "@/lib/user-registered-room";
import { writeAuditLog } from "@/lib/audit";
import type { RegisteredRoomRequestBody } from "@/types/api/registered-room";

export const dynamic = "force-dynamic";

const ROOM_ALREADY_REGISTERED_MESSAGE =
  "既に登録されているため登録できません";

function getRequiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    room: await getUserRegisteredRoom(userId),
  });
}

export async function PUT(request: NextRequest) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RegisteredRoomRequestBody;

  try {
    body = (await request.json()) as RegisteredRoomRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const roomId = getRequiredText(body.roomId);
  const roomUrl = getRequiredText(body.roomUrl);
  const inviteCode = getRequiredText(body.inviteCode);

  if (!roomId || !roomUrl || !inviteCode) {
    return Response.json(
      { error: "roomId, roomUrl and inviteCode are required" },
      { status: 400 }
    );
  }

  logger.info("Room registration attempt", { userId, roomId });

  const [currentUserRoom, isTopAdmin] = await Promise.all([
    getUserRegisteredRoom(userId),
    hasTopAdminRole(userId),
  ]);

  if (currentUserRoom) {
    logger.warn("Room registration rejected: user already has a registered room", {
      userId,
      existingRoomId: currentUserRoom.roomId,
    });
    return Response.json(
      { error: ROOM_ALREADY_REGISTERED_MESSAGE },
      { status: 409 }
    );
  }

  if (!isTopAdmin) {
    const existingOwner = await getRegisteredRoomOwner(userId, roomId, roomUrl);

    if (existingOwner) {
      logger.warn("Room registration rejected: room already registered by another user", {
        userId,
        roomId,
        existingOwnerUserId: existingOwner.userId,
      });
      return Response.json(
        { error: ROOM_ALREADY_REGISTERED_MESSAGE },
        { status: 409 }
      );
    }
  }

  try {
    const room = await prisma.$transaction(async (tx) => {
      const consumedInviteCode = await consumeInvitationCode(
        inviteCode,
        userId,
        tx
      );
      logger.debug("Invitation code consumed", { userId, inviteCodeId: consumedInviteCode.id });

      const registeredRoom = await saveUserRegisteredRoom(
        userId,
        {
          imageUrl: getOptionalText(body.imageUrl),
          inviteCodeId: consumedInviteCode.id,
          roomId,
          roomName: getOptionalText(body.roomName),
          roomUrl,
        },
        tx
      );

      await ensureUserInvitationCodes(userId, tx);

      const inviterAdminRole = consumedInviteCode.inviterUserId
        ? await tx.userRole.findFirst({
            where: {
              userId: consumedInviteCode.inviterUserId,
              role: { name: TOP_ADMIN_ROLE_NAME },
            },
            select: { id: true },
          })
        : null;

      if (inviterAdminRole) {
        const premiumRole = await tx.role.findUnique({
          where: { name: PREMIUM_ROLE_NAME },
          select: { id: true },
        });

        if (premiumRole) {
          await tx.userRole.upsert({
            where: { userId_roleId: { userId, roleId: premiumRole.id } },
            update: { assignedByUserId: consumedInviteCode.inviterUserId },
            create: {
              userId,
              roleId: premiumRole.id,
              assignedByUserId: consumedInviteCode.inviterUserId,
            },
            select: { id: true },
          });

          await writeAuditLog(
            {
              actorUserId: consumedInviteCode.inviterUserId,
              action: "role.assign",
              resource: "user",
              resourceId: userId,
              detail: {
                roleName: PREMIUM_ROLE_NAME,
                reason: "admin_invite_code",
              },
            },
            tx
          );

          logger.info("Premium role granted via admin invite code", {
            userId,
            inviterUserId: consumedInviteCode.inviterUserId,
          });
        }
      }

      await writeAuditLog(
        {
          actorUserId: userId,
          action: "room.register",
          resource: "user_registered_room",
          resourceId: registeredRoom.roomId,
          detail: {
            inviteCode: consumedInviteCode.code,
            roomId: registeredRoom.roomId,
            roomName: registeredRoom.roomName,
            roomUrl: registeredRoom.roomUrl,
          },
        },
        tx
      );

      return registeredRoom;
    });

    logger.info("Room registration succeeded", { userId, roomId: room.roomId, roomName: room.roomName });
    return Response.json({ room });
  } catch (error) {
    if (error instanceof InvalidInvitationCodeError) {
      logger.warn("Room registration rejected: invalid invitation code", { userId, roomId });
      return Response.json({ error: error.message }, { status: error.status });
    }

    logger.error("Room registration failed", { userId, roomId, error: String(error) });
    throw error;
  }
}
