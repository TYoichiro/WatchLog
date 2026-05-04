import { NextRequest } from "next/server";

import { getRoomUserProfile } from "@/lib/showroom";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("room_id");
  const userId = request.nextUrl.searchParams.get("user_id");

  if (!roomId) {
    return Response.json({ error: "room_id is required" }, { status: 400 });
  }

  if (!userId) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    return Response.json({
      profile: await getRoomUserProfile(roomId, userId),
    });
  } catch {
    return Response.json(
      { error: "Failed to fetch upstream API" },
      { status: 502 }
    );
  }
}
