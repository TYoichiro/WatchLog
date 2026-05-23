import { type NextRequest } from "next/server";

import { auth } from "@/auth";
import { getRegisteredRoomOwner } from "@/lib/user-registered-room";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const roomId = searchParams.get("roomId")?.trim() ?? "";
  const roomUrl = searchParams.get("roomUrl")?.trim() ?? "";

  if (!roomId || !roomUrl) {
    return Response.json(
      { error: "roomId and roomUrl are required" },
      { status: 400 }
    );
  }

  const existingOwner = await getRegisteredRoomOwner(userId, roomId, roomUrl);
  return Response.json({ isDuplicate: existingOwner !== null });
}
