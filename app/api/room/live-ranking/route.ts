import { NextRequest } from "next/server";

import { filterBlockedShowroomItems } from "@/lib/showroom-block-filter";
import { getRoomLiveRanking } from "@/lib/showroom";
import { getOptionalBlockedUserIds } from "@/lib/user-blocks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("room_id");

  if (!roomId) {
    return Response.json({ error: "room_id is required" }, { status: 400 });
  }

  try {
    const [ranking, blockedUserIds] = await Promise.all([
      getRoomLiveRanking(roomId),
      getOptionalBlockedUserIds(),
    ]);

    return Response.json({
      ranking: filterBlockedShowroomItems(ranking, blockedUserIds),
    });
  } catch {
    return Response.json(
      { error: "Failed to fetch upstream API" },
      { status: 502 }
    );
  }
}
