import { auth } from "@/auth";
import { getUserRoles } from "@/lib/authz";
import { logger } from "@/lib/logger";
import {
  getBcsvrKeyFromOnlives,
  getRoomCommentLog,
  getRoomGiftDefinitions,
  getRoomGiftLog,
  getRoomLiveInfo,
  getRoomTelop,
} from "@/lib/showroom";
import { filterBlockedShowroomItems } from "@/lib/showroom-block-filter";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";
import { getCachedBlockedShowroomUserIds } from "@/lib/user-blocks";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [registeredRoom, { isPremium }] = await Promise.all([
    userId ? getUserRegisteredRoom(userId) : Promise.resolve(null),
    userId ? getUserRoles(userId) : Promise.resolve({ isAdmin: false, isPremium: false }),
  ]);
  const parsedRoomId = registeredRoom ? Number(registeredRoom.roomId) : NaN;

  if (!registeredRoom || !Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
    return Response.json({ status: "no_room" });
  }

  const { roomId, roomUrl } = registeredRoom;

  const blockedUserIds = userId
    ? new Set(await getCachedBlockedShowroomUserIds(userId))
    : new Set<string>();

  const [liveInfoResult, giftDefinitionsResult, commentsResult, giftsResult, telopResult] =
    await Promise.allSettled([
      getRoomLiveInfo(roomId),
      getRoomGiftDefinitions(roomId),
      getRoomCommentLog(roomId),
      getRoomGiftLog(roomId),
      getRoomTelop(roomId),
    ]);

  let liveInfo = liveInfoResult.status === "fulfilled" ? liveInfoResult.value : null;

  if (liveInfoResult.status === "rejected") {
    logger.warn("オンライブ初期化: liveInfo取得失敗", { userId, roomId, error: String(liveInfoResult.reason) });
  }

  if (liveInfo?.isPremiumLive) {
    try {
      const bcsvrKey = await getBcsvrKeyFromOnlives(parsedRoomId);
      liveInfo = { ...liveInfo, bcsvrKey };
    } catch (error) {
      logger.debug("オンライブ初期化: bcsvrKey取得失敗", { userId, roomId, error: String(error) });
      // keep bcsvrKey as null; client will show the premium live dialog
    }
  }

  if (userId && liveInfo && liveInfo.liveStatus !== null && liveInfo.liveStatus !== 1) {
    logger.info("オンライブ画面: 配信中のルーム", { userId, roomId, roomUrl });
  }

  const giftDefinitions = giftDefinitionsResult.status === "fulfilled" ? giftDefinitionsResult.value : [];
  const rawComments = commentsResult.status === "fulfilled" ? commentsResult.value : [];
  const rawGifts = giftsResult.status === "fulfilled" ? giftsResult.value : [];
  const telop = telopResult.status === "fulfilled" ? telopResult.value : null;

  return Response.json({
    status: "ok",
    roomId: parsedRoomId,
    isPremium,
    liveInfo,
    giftDefinitions,
    comments: filterBlockedShowroomItems(rawComments, blockedUserIds),
    gifts: filterBlockedShowroomItems(rawGifts, blockedUserIds),
    telop,
  });
}
