import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import {
  getRoomCommentLog,
  getRoomGiftDefinitions,
  getRoomGiftLog,
  getRoomLiveInfo,
  getRoomTelop,
} from "@/lib/showroom";
import { filterBlockedShowroomItems } from "@/lib/showroom-block-filter";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";
import { listBlockedShowroomUserIds } from "@/lib/user-blocks";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const registeredRoom = userId ? await getUserRegisteredRoom(userId) : null;
  const parsedRoomId = registeredRoom ? Number(registeredRoom.roomId) : NaN;

  if (!registeredRoom || !Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
    return Response.json({ status: "no_room" });
  }

  const { roomId, roomUrl } = registeredRoom;

  const blockedUserIds = userId
    ? new Set(await listBlockedShowroomUserIds(userId))
    : new Set<string>();

  const [liveInfoResult, giftDefinitionsResult, commentsResult, giftsResult, telopResult] =
    await Promise.allSettled([
      getRoomLiveInfo(roomId),
      getRoomGiftDefinitions(roomId),
      getRoomCommentLog(roomId),
      getRoomGiftLog(roomId),
      getRoomTelop(roomId),
    ]);

  const liveInfo = liveInfoResult.status === "fulfilled" ? liveInfoResult.value : null;

  if (userId && liveInfo && liveInfo.liveStatus !== null && liveInfo.liveStatus !== 1) {
    logger.info("Onlive screen: room is live", { userId, roomId, roomUrl });
  }

  const giftDefinitions = giftDefinitionsResult.status === "fulfilled" ? giftDefinitionsResult.value : [];
  const rawComments = commentsResult.status === "fulfilled" ? commentsResult.value : [];
  const rawGifts = giftsResult.status === "fulfilled" ? giftsResult.value : [];
  const telop = telopResult.status === "fulfilled" ? telopResult.value : null;

  return Response.json({
    status: "ok",
    roomId: parsedRoomId,
    liveInfo,
    giftDefinitions,
    comments: filterBlockedShowroomItems(rawComments, blockedUserIds),
    gifts: filterBlockedShowroomItems(rawGifts, blockedUserIds),
    telop,
  });
}
