import { NextRequest } from "next/server";

import { getRoomEventAndSupport } from "@/lib/showroom";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("room_id");

  if (!roomId) {
    return Response.json({ error: "room_id is required" }, { status: 400 });
  }

  try {
    return Response.json(await getRoomEventAndSupport(roomId));
  } catch {
    return Response.json(
      { error: "Failed to fetch upstream API" },
      { status: 502 }
    );
  }
}
