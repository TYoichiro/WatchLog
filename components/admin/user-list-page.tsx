"use client";

import { useState } from "react";
import { ShieldAlert, Tv, UserIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export type UserListItem = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isBanned: boolean;
  createdAt: string;
  roles: { name: string }[];
  registeredRoom: {
    roomId: string;
    roomUrl: string;
    roomName: string | null;
  } | null;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
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

type BanStatus = "allowed" | "banned";

function BanSelect({
  userId,
  initialIsBanned,
  isAdmin,
}: {
  userId: string;
  initialIsBanned: boolean;
  isAdmin: boolean;
}) {
  const [status, setStatus] = useState<BanStatus>(initialIsBanned ? "banned" : "allowed");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleChange(next: BanStatus) {
    if (next === status || pending) return;
    setPending(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: next === "banned" }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setStatus(next);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  if (isAdmin) {
    return (
      <span className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
        管理者
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5 sm:items-end">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value as BanStatus)}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 data-[banned=true]:border-red-200 data-[banned=true]:text-red-700"
        data-banned={status === "banned"}
        aria-label="ステータス変更"
      >
        <option value="allowed">許可</option>
        <option value="banned">BAN</option>
      </select>
      {error && (
        <p className="text-xs text-red-500">変更に失敗しました</p>
      )}
    </div>
  );
}

export function UserListPage({ users, currentUserId }: { users: UserListItem[]; currentUserId: string }) {
  const bannedCount = users.filter((u) => u.isBanned).length;

  return (
    <>
      <section className="shrink-0">
        <h1 className="text-xl font-semibold text-slate-950">
          ユーザー一覧{" "}
          <span className="font-normal text-slate-500">{users.length}件</span>
        </h1>
        {bannedCount > 0 && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-red-600">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            {bannedCount}件のBANユーザーがいます
          </p>
        )}
      </section>

      {users.length === 0 ? (
        <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardContent className="p-8 text-sm text-slate-600">
            ユーザーはいません。
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          {users.map((user) => {
            const isAdmin = user.roles.some((r) => r.name === "admin");
            const isSelf = user.id === currentUserId;

            return (
              <div
                key={user.id}
                className="grid gap-3 border-b border-slate-100 p-4 transition hover:bg-slate-50 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="hidden h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:block">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt={user.name ?? ""}
                      className="h-full w-full object-cover"
                      width={40}
                      height={40}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <UserIcon className="h-5 w-5 text-slate-400" aria-hidden />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-950">
                      {user.name ?? "（名前未設定）"}
                    </p>
                    {isSelf && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        自分
                      </span>
                    )}
                    {isAdmin && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        管理者
                      </span>
                    )}
                    {user.isBanned && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        BAN
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="truncate">{user.email ?? "（メール未設定）"}</span>
                    {user.registeredRoom ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <Tv className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {user.registeredRoom.roomName ?? user.registeredRoom.roomUrl}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Tv className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        未登録
                      </span>
                    )}
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  {!isSelf && (
                    <BanSelect
                      userId={user.id}
                      initialIsBanned={user.isBanned}
                      isAdmin={isAdmin}
                    />
                  )}
                  {isSelf && (
                    <span className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
                      操作不可
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
