import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ShowTubeLivePage } from "@/components/showtube/showtube-live-page";
import { ShowTubeShell } from "@/components/showtube/showtube-shell";
import { getUserRoles } from "@/lib/authz";
import { getOnlives } from "@/lib/showroom";
import type { OnliveItem } from "@/lib/showroom";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ShowTube | WatchLog",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const { isAdmin, isPremium } = await getUserRoles(userId);

  if (!isAdmin && !isPremium) {
    redirect("/dashboard");
  }

  const { genre } = await searchParams;
  const selectedGenreId = genre !== undefined ? parseInt(genre, 10) : null;

  const [onlivesResult] = await Promise.allSettled([getOnlives()]);
  const onlives = onlivesResult.status === "fulfilled" ? onlivesResult.value : null;
  const onlivesHasError = onlivesResult.status === "rejected";

  const genres = onlives?.onlives.map((g) => ({
    genreId: g.genreId,
    genreName: g.genreName,
  })) ?? [];

  let items: OnliveItem[] = [];
  if (onlives) {
    const seen = new Set<string>();
    const dedupe = (lives: OnliveItem[]) =>
      lives.filter((item) => {
        const k = String(item.roomId);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (selectedGenreId !== null && !isNaN(selectedGenreId)) {
      const genreData = onlives.onlives.find((g) => g.genreId === selectedGenreId);
      items = dedupe(genreData?.lives ?? []);
    } else {
      items = dedupe(onlives.onlives.flatMap((g) => g.lives));
    }
  }

  return (
    <ShowTubeShell genres={genres} selectedGenreId={selectedGenreId}>
      <ShowTubeLivePage items={items} hasError={onlivesHasError} />
    </ShowTubeShell>
  );
}
