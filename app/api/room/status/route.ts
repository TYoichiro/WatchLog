import { NextRequest } from "next/server";

import { getRoomStatus } from "@/lib/showroom";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const roomUrlKey = request.nextUrl.searchParams.get("room_url_key");

  if (!roomUrlKey) {
    return Response.json(
      { error: "room_url_key is required" },
      { status: 400 }
    );
  }

  try {
    return Response.json(await getRoomStatus(roomUrlKey));
  } catch {
    return Response.json(
      { error: "Failed to fetch upstream API" },
      { status: 502 }
    );
  }
}
