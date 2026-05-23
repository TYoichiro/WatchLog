import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ShowTubeShell } from "@/components/showtube/showtube-shell";
import { ShowTubeWatchPage } from "@/components/showtube/showtube-watch-page";
import { hasTopAdminRole, hasPremiumRole } from "@/lib/authz";
import { getOnlives, getHlsStreamingUrls, getRoomCommentLog, getRoomLiveInfo } from "@/lib/showroom";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "視聴 | ShowTube | WatchLog",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ room_id?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const [isAdmin, isPremium] = await Promise.all([
    hasTopAdminRole(userId),
    hasPremiumRole(userId),
  ]);

  if (!isAdmin && !isPremium) {
    redirect("/dashboard");
  }

  const { room_id } = await searchParams;
  const roomId = room_id ? parseInt(room_id, 10) : null;

  if (!roomId || isNaN(roomId)) {
    redirect("/showtube");
  }

  const [onlivesResult, streamingUrlsResult, commentsResult, liveInfoResult] =
    await Promise.allSettled([
      getOnlives(),
      getHlsStreamingUrls(roomId),
      getRoomCommentLog(roomId),
      getRoomLiveInfo(roomId),
    ]);

  const onlives = onlivesResult.status === "fulfilled" ? onlivesResult.value : null;
  const streamingUrls =
    streamingUrlsResult.status === "fulfilled" ? streamingUrlsResult.value : [];
  const initialComments =
    commentsResult.status === "fulfilled" ? commentsResult.value : [];
  const bcsvrKey =
    liveInfoResult.status === "fulfilled" ? liveInfoResult.value.bcsvrKey : null;

  const genres =
    onlives?.onlives.map((g) => ({
      genreId: g.genreId,
      genreName: g.genreName,
    })) ?? [];

  const item =
    onlives?.onlives.flatMap((g) => g.lives).find((l) => l.roomId === roomId) ??
    null;

  return (
    <ShowTubeShell genres={genres} selectedGenreId={null}>
      <ShowTubeWatchPage
        item={item}
        roomId={roomId}
        streamingUrls={streamingUrls}
        initialComments={initialComments}
        bcsvrKey={bcsvrKey}
      />
    </ShowTubeShell>
  );
}
