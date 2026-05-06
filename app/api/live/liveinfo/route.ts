import { NextRequest } from "next/server";

import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { getRoomLiveInfo } from "@/lib/showroom";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("room_id");

  if (!roomId) {
    return Response.json({ error: "room_id is required" }, { status: 400 });
  }

  try {
    const [liveInfo, session] = await Promise.all([
      getRoomLiveInfo(roomId),
      auth(),
    ]);

    const userId = session?.user?.id;
    const isInitial = request.nextUrl.searchParams.get("initial") === "1";

    // 初回アクセス かつ 配信中（liveStatus === 1 は配信外）のときだけログ出力
    if (isInitial && userId && liveInfo.liveStatus !== null && liveInfo.liveStatus !== 1) {
      const registeredRoom = await getUserRegisteredRoom(userId);
      logger.info("Onlive screen: room is live", {
        userId,
        roomId,
        roomUrl: registeredRoom?.roomUrl ?? null,
      });
    }

    return Response.json(liveInfo);
  } catch {
    return Response.json(
      { error: "Failed to fetch upstream API" },
      { status: 502 }
    );
  }
}
