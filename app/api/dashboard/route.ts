import { auth } from "@/auth";
import { hasTopAdminRole } from "@/lib/authz";
import { getDashboardNotices } from "@/lib/dashboard-notices";
import {
  getRoomActiveFan,
  getRoomEventAndSupport,
  getRoomProfile,
  getRoomStatus,
} from "@/lib/showroom";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const registeredRoom = await getUserRegisteredRoom(session.user.id);

  if (!registeredRoom) {
    return Response.json({ status: "no_room" });
  }

  const { roomId, roomUrl } = registeredRoom;
  const isAdmin = await hasTopAdminRole(session.user.id);

  const [profileResult, activeFanResult, eventAndSupportResult, noticesResult, roomStatusResult] =
    await Promise.allSettled([
      getRoomProfile(roomId),
      getRoomActiveFan(roomId),
      getRoomEventAndSupport(roomId),
      getDashboardNotices(),
      getRoomStatus(roomUrl),
    ]);

  const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
  const activeFan = activeFanResult.status === "fulfilled" ? activeFanResult.value : null;
  const eventAndSupport = eventAndSupportResult.status === "fulfilled" ? eventAndSupportResult.value : null;
  const notices = noticesResult.status === "fulfilled" ? noticesResult.value : [];
  const noticesHasError = noticesResult.status === "rejected";
  const roomStatus = roomStatusResult.status === "fulfilled" ? roomStatusResult.value : null;

  const isLive = profile?.isOnlive === true || roomStatus?.isLive === true;

  return Response.json({
    status: isLive ? "is_live" : "ok",
    isAdmin,
    registeredRoom: { roomId, roomUrl },
    profile,
    activeFan,
    eventAndSupport,
    notices,
    noticesHasError,
    roomStatus,
  });
}
