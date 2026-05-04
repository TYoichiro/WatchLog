import { NextRequest } from "next/server";

import { auth } from "@/auth";
import { filterBlockedShowroomItems } from "@/lib/showroom-block-filter";
import { getRoomCommentLog } from "@/lib/showroom";
import { listBlockedShowroomUserIds } from "@/lib/user-blocks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("room_id");

  if (!roomId) {
    return Response.json({ error: "room_id is required" }, { status: 400 });
  }

  try {
    const [comments, session] = await Promise.all([
      getRoomCommentLog(roomId),
      auth(),
    ]);
    const userId = session?.user?.id;
    const blockedUserIds = userId
      ? new Set(await listBlockedShowroomUserIds(userId))
      : new Set<string>();

    return Response.json({
      comments: filterBlockedShowroomItems(comments, blockedUserIds),
    });
  } catch {
    return Response.json(
      { error: "Failed to fetch upstream API" },
      { status: 502 }
    );
  }
}
