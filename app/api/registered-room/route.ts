import { NextRequest } from "next/server";

import { auth } from "@/auth";
import { hasTopAdminRole } from "@/lib/authz";
import {
  consumeInvitationCode,
  ensureUserInvitationCodes,
  InvalidInvitationCodeError,
} from "@/lib/invitations";
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

  const [currentUserRoom, isTopAdmin] = await Promise.all([
    getUserRegisteredRoom(userId),
    hasTopAdminRole(userId),
  ]);

  if (currentUserRoom) {
    return Response.json(
      { error: ROOM_ALREADY_REGISTERED_MESSAGE },
      { status: 409 }
    );
  }

  if (!isTopAdmin) {
    const existingOwner = await getRegisteredRoomOwner(userId, roomId, roomUrl);

    if (existingOwner) {
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

    return Response.json({ room });
  } catch (error) {
    if (error instanceof InvalidInvitationCodeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
