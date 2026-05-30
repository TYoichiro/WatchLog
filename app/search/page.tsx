"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { Hash, KeyRound, Loader2, Search } from "lucide-react";
import { AppShell } from "@/components/navigation/app-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  checkRoomDuplicate,
  fetchRegisteredRoom,
  saveRegisteredRoom,
} from "@/lib/registered-room";
import type {
  InvitationVerificationResponse,
  RoomResult,
  SearchResponse,
} from "@/types/pages/search";


function hasRoomResults(items: readonly RoomResult[]): boolean {
  return items.length > 0;
}

function getRoomResultCount(items: readonly RoomResult[]): number {
  return items.length;
}

function canRegisterRoom(room: RoomResult | null): room is RoomResult {
  return room !== null;
}

function normalizeInviteCodeInput(value: string): string {
  return value.trim().toUpperCase();
}

function isInviteCodeFormatValid(value: string): boolean {
  return /^[A-Z0-9]{10}$/.test(value);
}

type VerifyResult =
  | { valid: true }
  | { valid: false; banned: true }
  | { valid: false; banned?: false; remainingAttempts: number };

async function verifyInvitationCode(inviteCode: string): Promise<VerifyResult> {
  const response = await fetch("/api/invitations/verify", {
    body: JSON.stringify({ inviteCode }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to verify invitation code");
  }

  const data = (await response.json()) as InvitationVerificationResponse;

  if (data.valid === true) {
    return { valid: true };
  }
  if (data.banned === true) {
    return { valid: false, banned: true };
  }
  return { valid: false, remainingAttempts: data.remainingAttempts ?? 0 };
}

function SearchArea({
  isLoading,
  onQueryChange,
  onSubmit,
  query,
}: {
  isLoading: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  query: string;
}) {
  return (
    <Card className="rounded-xl border-0 shadow-sm">
      <CardContent className="p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={onSubmit}
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="ルーム名を検索"
              className="h-12 rounded-xl border-slate-200 pl-12"
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            className="h-12 rounded-xl px-8"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
            検索
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function InvitationCodeModal({
  errorMessage,
  isSubmitting,
  onSubmit,
}: {
  errorMessage: string | null;
  isSubmitting: boolean;
  onSubmit: (inviteCode: string) => void;
}) {
  const [inviteCode, setInviteCode] = useState("");

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(inviteCode);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-code-title"
      className="fixed inset-0 z-120 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <KeyRound className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 id="invite-code-title" className="text-lg font-semibold text-slate-900">
              招待コードを入力
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              ルーム登録には招待コードが必要です。
            </p>
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Input
            value={inviteCode}
            onChange={(event) =>
              setInviteCode(event.target.value.toUpperCase())
            }
            placeholder="ABCD123456"
            className="h-12 rounded-xl border-slate-200 font-mono text-base"
            disabled={isSubmitting}
            maxLength={10}
            autoFocus
          />

          <div className="min-h-10">
            {errorMessage ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {errorMessage}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                10桁の英数字を入力してください。
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="h-12 w-full rounded-xl"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden />
            )}
            確認
          </Button>
        </form>
      </div>
    </div>
  );
}

function ConfirmRegisterModal({
  onClose,
  onConfirm,
  room,
}: {
  onClose: () => void;
  onConfirm: (room: RoomResult) => void;
  room: RoomResult;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-register-title"
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 id="confirm-register-title" className="text-lg font-semibold text-slate-900">
          登録しますか？
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {room.roomName || room.roomUrl} を登録します。
        </p>
        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg bg-slate-50 p-3 text-sm">
          <dt className="text-slate-500">ルームID</dt>
          <dd className="font-medium text-slate-900">{room.roomId}</dd>
          <dt className="text-slate-500">ルームURL</dt>
          <dd className="truncate font-medium text-slate-900">{room.roomUrl}</dd>
        </dl>
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
          ルームは配信者本人しか登録できません。他人が登録をすると配信者本人が使えなくなるので注意してください。
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={onClose}
          >
            いいえ
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => onConfirm(room)}
          >
            はい
          </Button>
        </div>
      </div>
    </div>
  );
}

function RegisterErrorModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-error-title"
      className="fixed inset-0 z-110 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h2 id="register-error-title" className="text-lg font-semibold text-slate-900">
          登録できません
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          配信者本人ですが、他人に取られている場合は
          <a
            href="https://x.com/yoichiro_sub"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            こちら
          </a>
        </p>
        <div className="mt-6 flex justify-end">
          <Button type="button" className="rounded-xl" onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoomCard({
  onClick,
  room,
}: {
  onClick: (room: RoomResult) => void;
  room: RoomResult;
}) {
  const roomTitle = room.roomName || room.roomUrl;

  return (
    <button
      type="button"
      onClick={() => onClick(room)}
      className="group overflow-hidden cursor-pointer rounded-xl bg-white text-left shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-video w-full overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={room.imageUrl}
          alt={roomTitle}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          width={420}
          height={236}
        />
      </div>
      <div className="space-y-3 p-4">
        <p className="truncate text-base font-semibold text-slate-900">
          {roomTitle}
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Hash className="h-4 w-4" aria-hidden />
          <span className="font-medium text-slate-700">{room.roomId}</span>
        </div>
        <p className="truncate rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {room.roomUrl}
        </p>
      </div>
    </button>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70"
        >
          <div className="aspect-video animate-pulse bg-slate-200" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-9 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-72 items-center justify-center rounded-xl bg-white p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function ResultsPanel({
  errorMessage,
  isLoading,
  onSelectRoom,
  results,
  searchedKeyword,
}: {
  errorMessage: string | null;
  isLoading: boolean;
  onSelectRoom: (room: RoomResult) => void;
  results: RoomResult[];
  searchedKeyword: string;
}) {
  const hasSearched = searchedKeyword.length > 0;

  return (
    <section className="min-h-0 flex-1 overflow-auto rounded-xl bg-white/40 p-1">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">検索結果</h2>
          <p className="mt-1 text-xs text-slate-500">
            {hasSearched
              ? `${searchedKeyword} / ${getRoomResultCount(results)}件`
              : "キーワードを入力して検索してください"}
          </p>
        </div>
      </div>

      {isLoading ? <LoadingGrid /> : null}

      {!isLoading && errorMessage ? <EmptyState message={errorMessage} /> : null}

      {!isLoading && !errorMessage && !hasSearched ? (
        <EmptyState message="ルーム名を検索してください。" />
      ) : null}

      {!isLoading && !errorMessage && hasSearched && !hasRoomResults(results) ? (
        <EmptyState message="該当するルームが見つかりませんでした。" />
      ) : null}

      {!isLoading && !errorMessage && hasRoomResults(results) ? (
        <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {results.map((room) => (
            <RoomCard
              key={`${room.roomId}:${room.roomUrl}`}
              room={room}
              onClick={onSelectRoom}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RoomSearchBody() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteCodeErrorMessage, setInviteCodeErrorMessage] = useState<
    string | null
  >(null);
  const [isInviteCodeSubmitting, setIsInviteCodeSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [registerErrorMessage, setRegisterErrorMessage] = useState<
    string | null
  >(null);
  const [results, setResults] = useState<RoomResult[]>([]);
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<RoomResult | null>(null);
  const [verifiedInviteCode, setVerifiedInviteCode] = useState<string | null>(
    null
  );
  const handleInviteCodeSubmit = async (rawInviteCode: string) => {
    const inviteCode = normalizeInviteCodeInput(rawInviteCode);

    if (!isInviteCodeFormatValid(inviteCode)) {
      setInviteCodeErrorMessage("招待コードの形式が正しくありません。");
      return;
    }

    setIsInviteCodeSubmitting(true);

    try {
      const result = await verifyInvitationCode(inviteCode);

      if (result.valid) {
        setInviteCodeErrorMessage(null);
        setVerifiedInviteCode(inviteCode);
        return;
      }

      if (result.banned) {
        setInviteCodeErrorMessage(
          "招待コードの入力に3回失敗したため、アカウントがBANされました。"
        );
        router.push("/banned");
        return;
      }

      setInviteCodeErrorMessage(
        `招待コードが正しくありません。残り${result.remainingAttempts}回入力できます。`
      );
    } catch {
      setInviteCodeErrorMessage(
        "招待コードを確認できませんでした。時間をおいて再試行してください。"
      );
    } finally {
      setIsInviteCodeSubmitting(false);
    }
  };

  const handleSearch = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const keyword = query.trim();
    setSelectedRoom(null);
    setRegisterErrorMessage(null);

    if (!keyword) {
      setErrorMessage("検索キーワードを入力してください。");
      setResults([]);
      setSearchedKeyword("");
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setResults([]);
    setSearchedKeyword(keyword);

    try {
      const response = await fetch(
        `/api/room/search?keyword=${encodeURIComponent(keyword)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const data = (await response.json()) as SearchResponse;
      setResults(Array.isArray(data.rooms) ? data.rooms : []);
    } catch {
      setErrorMessage(
        "検索結果を取得できませんでした。時間をおいて再試行してください。"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (room: RoomResult) => {
    setRegisterErrorMessage(null);

    if (!verifiedInviteCode) {
      setSelectedRoom(null);
      setInviteCodeErrorMessage("招待コードを入力してください。");
      return;
    }

    try {
      const isDuplicate = await checkRoomDuplicate(room.roomId, room.roomUrl);

      if (isDuplicate) {
        setSelectedRoom(null);
        setRegisterErrorMessage("既に登録されているため登録できません");
        return;
      }
    } catch {
      setSelectedRoom(null);
      setRegisterErrorMessage(
        "ルームの重複確認ができませんでした。時間をおいて再試行してください。"
      );
      return;
    }

    try {
      await saveRegisteredRoom({
        ...room,
        inviteCode: verifiedInviteCode,
      });
      router.replace("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "ルームを登録できませんでした。時間をおいて再試行してください。";

      setSelectedRoom(null);

      if (message.includes("招待コード")) {
        setInviteCodeErrorMessage(message);
        setVerifiedInviteCode(null);
        return;
      }

      setRegisterErrorMessage(message);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 xl:min-h-0">
      <SearchArea
        isLoading={isLoading}
        onQueryChange={setQuery}
        onSubmit={handleSearch}
        query={query}
      />

      <ResultsPanel
        errorMessage={errorMessage}
        isLoading={isLoading}
        onSelectRoom={setSelectedRoom}
        results={results}
        searchedKeyword={searchedKeyword}
      />

      {canRegisterRoom(selectedRoom) ? (
        <ConfirmRegisterModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onConfirm={handleRegister}
        />
      ) : null}

      {registerErrorMessage ? (
        <RegisterErrorModal
          message={registerErrorMessage}
          onClose={() => setRegisterErrorMessage(null)}
        />
      ) : null}

      {!verifiedInviteCode ? (
        <InvitationCodeModal
          errorMessage={inviteCodeErrorMessage}
          isSubmitting={isInviteCodeSubmitting}
          onSubmit={handleInviteCodeSubmit}
        />
      ) : null}
    </div>
  );
}

export default function ShowroomRoomSearchPage() {
  const router = useRouter();
  const [canShowSearch, setCanShowSearch] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function checkRegisteredRoom() {
      try {
        const registeredRoom = await fetchRegisteredRoom(controller.signal);

        if (!isActive) {
          return;
        }

        if (registeredRoom) {
          router.replace("/dashboard");
          return;
        }

        setCanShowSearch(true);
      } catch (error) {
        if (!isActive || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        setCanShowSearch(true);
      }
    }

    const timeoutId = window.setTimeout(() => {
      void checkRegisteredRoom();
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [router]);

  if (!canShowSearch) {
    return null;
  }

  return (
    <AppShell
      activeKey="search"
      mainClassName="xl:overflow-hidden"
      showMenu={false}
    >
      <RoomSearchBody />
    </AppShell>
  );
}
