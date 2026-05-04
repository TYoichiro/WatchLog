import { NextRequest } from "next/server";

import { searchShowroomRooms } from "@/lib/showroom";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword")?.trim();

  if (!keyword) {
    return Response.json({ error: "keyword is required" }, { status: 400 });
  }

  try {
    return Response.json({ rooms: await searchShowroomRooms(keyword) });
  } catch {
    return Response.json(
      { error: "Failed to fetch upstream HTML" },
      { status: 502 }
    );
  }
}
