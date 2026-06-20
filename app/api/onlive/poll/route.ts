import { auth } from "@/auth";
import {
  getRoomLiveRanking,
  getRoomProfile,
  getRoomTotalRanking,
} from "@/lib/showroom";
import { filterBlockedShowroomItems } from "@/lib/showroom-block-filter";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";
import { getCachedBlockedShowroomUserIds } from "@/lib/user-blocks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const registeredRoom = userId ? await getUserRegisteredRoom(userId) : null;

  if (!registeredRoom) {
    return Response.json({ error: "No registered room" }, { status: 404 });
  }

  const { roomId } = registeredRoom;
  const { searchParams } = new URL(request.url);
  const skipRanking = searchParams.get("skip_ranking") === "1";

  const blockedUserIds = userId
    ? new Set(await getCachedBlockedShowroomUserIds(userId))
    : new Set<string>();

  const [profileResult, liveRankingResult, totalRankingResult] =
    await Promise.allSettled([
      getRoomProfile(roomId),
      skipRanking ? Promise.resolve([]) : getRoomLiveRanking(roomId),
      skipRanking ? Promise.resolve([]) : getRoomTotalRanking(roomId),
    ]);

  const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
  const liveRanking = liveRankingResult.status === "fulfilled"
    ? filterBlockedShowroomItems(liveRankingResult.value, blockedUserIds)
    : [];
  const totalRanking = totalRankingResult.status === "fulfilled"
    ? filterBlockedShowroomItems(totalRankingResult.value, blockedUserIds)
    : [];

  return Response.json({
    profile,
    profileHasError: profileResult.status === "rejected",
    liveRanking,
    liveRankingHasError: skipRanking || liveRankingResult.status === "rejected",
    totalRanking,
    totalRankingHasError: skipRanking || totalRankingResult.status === "rejected",
  });
}
