"use client";

import { Hash } from "lucide-react";

import type { OnliveItem } from "@/lib/showroom";

function OnliveCard({ item }: { item: OnliveItem }) {
  return (
    <div className="group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="aspect-video w-full overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.mainName}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          width={420}
          height={236}
        />
      </div>
      <div className="space-y-2 p-4">
        <p className="truncate text-base font-semibold text-slate-900">
          {item.mainName}
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Hash className="h-4 w-4" aria-hidden />
          <span className="font-medium text-slate-700">{item.roomId}</span>
        </div>
      </div>
    </div>
  );
}

export function ShowTubeLivePage({
  items,
  hasError,
}: {
  items: OnliveItem[];
  hasError: boolean;
}) {
  if (hasError) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl bg-white p-8 text-center text-sm text-slate-500">
        データの取得に失敗しました。
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl bg-white p-8 text-center text-sm text-slate-500">
        ライブ中のルームはありません。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => (
        <OnliveCard key={item.roomId} item={item} />
      ))}
    </div>
  );
}
