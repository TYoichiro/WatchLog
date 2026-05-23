import type { RoomProfile } from "@/lib/showroom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function HeroCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-3xl border-0 py-0 shadow-sm">
      <Skeleton className="h-56 w-full rounded-none sm:h-72 lg:h-80" />
    </Card>
  );
}

export function HeroCard({ profile }: { profile: RoomProfile | null }) {
  return (
    <Card className="overflow-hidden rounded-3xl border-0 py-0 shadow-sm">
      <div className="relative h-56 w-full sm:h-72 lg:h-80">
        {profile?.roomImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.roomImageUrl}
            alt={profile.roomName || "ルーム画像"}
            className="h-full w-full object-cover"
            width={1600}
            height={900}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-r from-black/65 via-black/30 to-transparent" />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 sm:left-8">
          <Badge className="mb-3 rounded-full bg-white/20 px-3 py-1 text-white backdrop-blur">
            {profile?.isOfficial ? "公式枠ルーム" : "フリー枠ルーム"}
          </Badge>
          <h1 className="max-w-[80%] text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            {profile?.roomName || "ルーム情報を取得できませんでした"}
          </h1>
        </div>
      </div>
    </Card>
  );
}
