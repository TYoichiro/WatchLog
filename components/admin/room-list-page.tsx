"use client";

import { ExternalLink, Hash, User } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export type RoomListItem = {
  id: string;
  roomId: string;
  roomUrl: string;
  roomName: string | null;
  imageUrl: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
  };
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function RoomListPage({ rooms }: { rooms: RoomListItem[] }) {
  return (
    <>
      <section className="shrink-0">
        <h1 className="text-xl font-semibold text-slate-950">
          ルーム一覧{" "}
          <span className="font-normal text-slate-500">{rooms.length}件</span>
        </h1>
      </section>

      {rooms.length === 0 ? (
        <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardContent className="p-8 text-sm text-slate-600">
            登録済みルームはありません。
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="grid gap-3 border-b border-slate-100 p-4 transition hover:bg-slate-50 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="hidden h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:block">
                {room.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={room.imageUrl}
                    alt={room.roomName ?? room.roomUrl}
                    className="h-full w-full object-cover"
                    width={80}
                    height={56}
                  />
                ) : null}
              </div>

              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">
                  {room.roomName ?? room.roomUrl}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {room.roomId}
                  </span>
                  <span className="inline-flex items-center gap-1 truncate">
                    <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {room.user.name ?? "（名前未設定）"}
                  </span>
                  <span>{formatDate(room.createdAt)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <a
                  href={`https://www.showroom-live.com/room/profile?room_id=${encodeURIComponent(room.roomId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  プロフィール
                </a>
                <a
                  href={`https://www.showroom-live.com/r/${room.roomUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  配信ページ
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
