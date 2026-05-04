"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { UserProfileModal } from "@/components/onlive/onlive-room-page";
import type {
  ProfileTarget,
  ProfileView,
} from "@/components/onlive/onlive-room-page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUserBlocks, type UserBlockListItem } from "@/hooks/use-user-blocks";
import type { RoomUserProfile } from "@/lib/showroom";

type UserProfileResponse = {
  profile: RoomUserProfile;
};

function formatBlockedAt(value: string): string {
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
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function BlockTableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index} className="border-b border-slate-100 last:border-b-0">
          <td className="px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-44 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-3 text-right">
            <div className="ml-auto h-8 w-20 animate-pulse rounded bg-slate-100" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

export function BlockListPage({ roomId }: { roomId: string }) {
  const {
    blockedUserIds,
    blocks,
    blockUser,
    deleteBlock,
    hasError,
    isLoading,
  } = useUserBlocks();
  const [selectedProfileTarget, setSelectedProfileTarget] =
    useState<ProfileTarget | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, RoomUserProfile>>(
    {}
  );
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [hasProfileError, setHasProfileError] = useState(false);
  const [profileView, setProfileView] = useState<ProfileView>("user");
  const [pendingDeleteBlock, setPendingDeleteBlock] =
    useState<UserBlockListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
    null
  );
  const [isBlockActionPending, setIsBlockActionPending] = useState(false);
  const [blockErrorMessage, setBlockErrorMessage] = useState<string | null>(
    null
  );
  const activeProfile = selectedProfileTarget
    ? profileCache[selectedProfileTarget.userId] ?? null
    : null;

  useEffect(() => {
    if (!selectedProfileTarget || activeProfile) {
      return;
    }

    const currentTarget = selectedProfileTarget;
    const controller = new AbortController();

    async function loadProfile() {
      setIsProfileLoading(true);
      setHasProfileError(false);

      try {
        const response = await fetch(
          `/api/room/user-profile?room_id=${encodeURIComponent(
            roomId
          )}&user_id=${encodeURIComponent(currentTarget.userId)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch user profile");
        }

        const data = (await response.json()) as UserProfileResponse;
        setProfileCache((current) => ({
          ...current,
          [currentTarget.userId]: data.profile,
        }));
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setHasProfileError(true);
      } finally {
        setIsProfileLoading(false);
      }
    }

    void loadProfile();

    return () => controller.abort();
  }, [activeProfile, roomId, selectedProfileTarget]);

  const openProfile = (block: UserBlockListItem) => {
    setHasProfileError(false);
    setBlockErrorMessage(null);
    setProfileView("user");
    setSelectedProfileTarget({
      userId: block.blockedUserId,
      userName: block.blockedUserName,
    });
  };

  const handleProfileOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedProfileTarget(null);
      setHasProfileError(false);
      setIsProfileLoading(false);
      setBlockErrorMessage(null);
      setProfileView("user");
    }
  };

  const handleBlockUser = async (
    target: ProfileTarget,
    profile: RoomUserProfile | null
  ) => {
    setIsBlockActionPending(true);
    setBlockErrorMessage(null);

    try {
      await blockUser(target.userId, profile?.name || target.userName);
    } catch (error) {
      setBlockErrorMessage(
        error instanceof Error
          ? error.message
          : "ブロック登録に失敗しました"
      );
    } finally {
      setIsBlockActionPending(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteBlock) {
      return;
    }

    setIsDeleting(true);
    setDeleteErrorMessage(null);

    try {
      await deleteBlock(pendingDeleteBlock.id);
      setPendingDeleteBlock(null);
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof Error
          ? error.message
          : "ブロック解除に失敗しました"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <section className="shrink-0">
        <h1 className="text-xl font-semibold text-slate-950">
          ブロックユーザー{" "}
          <span className="font-normal text-slate-500">{blocks.length}件</span>
        </h1>
      </section>

      <Card className="overflow-hidden rounded-lg border-slate-200 py-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] border-collapse bg-white">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">ユーザー名</th>
                  <th className="px-4 py-3 font-medium">ブロック日時</th>
                  <th className="px-4 py-3 text-right font-medium">削除</th>
                </tr>
              </thead>
              {isLoading ? (
                <BlockTableSkeleton />
              ) : hasError ? (
                <tbody>
                  <tr>
                    <td colSpan={4} className="px-4 py-8">
                      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                        ブロック一覧を取得できませんでした。
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : blocks.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={4} className="px-4 py-8">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                        ブロック中のユーザーはいません。
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {blocks.map((block) => (
                    <tr
                      key={block.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">
                        {block.blockedUserId}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-left text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
                          onClick={() => openProfile(block)}
                        >
                          {block.blockedUserName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatBlockedAt(block.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setDeleteErrorMessage(null);
                            setPendingDeleteBlock(block);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          削除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <UserProfileModal
        blockedUserIds={blockedUserIds}
        blockErrorMessage={blockErrorMessage}
        hasError={hasProfileError}
        isBlockActionPending={isBlockActionPending}
        isLoading={isProfileLoading}
        onBlockUser={handleBlockUser}
        onOpenChange={handleProfileOpenChange}
        onViewChange={setProfileView}
        profile={activeProfile}
        target={selectedProfileTarget}
        view={profileView}
      />

      <AlertDialog
        open={pendingDeleteBlock !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDeleteBlock(null);
            setDeleteErrorMessage(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDeleteBlock
              ? `${pendingDeleteBlock.blockedUserName} のブロックを解除します。`
              : "ブロックを解除します。"}
          </AlertDialogDescription>
          {deleteErrorMessage ? (
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
              {deleteErrorMessage}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>いいえ</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              はい
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
