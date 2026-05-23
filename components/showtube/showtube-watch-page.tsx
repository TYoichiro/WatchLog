"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Hls from "hls.js";
import { ArrowLeft, Eye, Hash, Radio } from "lucide-react";

import type { HlsStreamingUrl, OnliveItem, RoomComment } from "@/lib/showroom";
import {
  SHOWROOM_SOCKET_URL,
  SHOWROOM_SOCKET_PING_MESSAGE,
  createShowroomSubscribeMessage,
  getShowroomSocketPayloadText,
} from "@/lib/showroom-realtime";
import { cn } from "@/lib/utils";

const MAX_COMMENTS = 300;
const PING_INTERVAL_MS = 60_000;

type WsStatus = "connecting" | "connected" | "disconnected";

type RealtimeMessage = {
  t?: number | string | null;
  cm?: string | null;
  ac?: string | null;
  u?: number | string | null;
  av?: number | string | null;
  cl?: number | string | null;
  created_at?: number | string | null;
};

// ─── Video Player ────────────────────────────────────────────────────────────

function HlsPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    }
  }, [url]);

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      className="h-full w-full bg-black"
    />
  );
}

// ─── Quality Selector ────────────────────────────────────────────────────────

function QualitySelector({
  options,
  selectedId,
  onChange,
}: {
  options: HlsStreamingUrl[];
  selectedId: number;
  onChange: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition",
            option.id === selectedId
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ─── Comment components ───────────────────────────────────────────────────────

function WsStatusBadge({ status }: { status: WsStatus }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "connected" && "bg-green-50 text-green-700",
        status === "connecting" && "bg-amber-50 text-amber-700",
        status === "disconnected" && "bg-slate-100 text-slate-500",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "connected" && "bg-green-500",
          status === "connecting" && "animate-pulse bg-amber-400",
          status === "disconnected" && "bg-slate-400",
        )}
      />
      {status === "connected" && "接続中"}
      {status === "connecting" && "接続中..."}
      {status === "disconnected" && "切断"}
    </span>
  );
}

function CommentItems({ comments }: { comments: RoomComment[] }) {
  if (comments.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-slate-400">
        コメントはありません
      </p>
    );
  }
  return (
    <>
      {comments.map((c) => (
        <div key={c.id} className="flex min-w-0 gap-1.5 text-sm leading-relaxed">
          <span className="max-w-24 shrink-0 truncate font-semibold text-slate-700">
            {c.name}
          </span>
          <span className="shrink-0 text-slate-400">:</span>
          <span className="break-all text-slate-600">{c.text}</span>
        </div>
      ))}
    </>
  );
}

// PC: 動画と同じ高さ（親から height を受け取る）
function CommentPanelDesktop({
  comments,
  wsStatus,
  height,
}: {
  comments: RoomComment[];
  wsStatus: WsStatus;
  height: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const initialScrolledRef = useRef(false);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  // height が確定したとき（初回のみ）末尾へ即時スクロール
  useEffect(() => {
    if (height !== null && !initialScrolledRef.current) {
      initialScrolledRef.current = true;
      const el = containerRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight });
    }
  }, [height]);

  // WebSocket で新着コメントが来たときスクロール
  useEffect(() => {
    if (autoScrollRef.current) {
      const el = containerRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [comments.length]);

  return (
    <div
      className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 lg:flex"
      style={height !== null ? { height } : undefined}
    >
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">コメント</p>
        <WsStatusBadge status={wsStatus} />
      </div>
      {/* flex-1 + min-h-0 で残高をすべて使い overflow-y-auto でスクロール */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto space-y-1.5 p-3"
      >
        <CommentItems comments={comments} />
      </div>
    </div>
  );
}

// モバイル: 固定高さ
function CommentPanelMobile({
  comments,
  wsStatus,
}: {
  comments: RoomComment[];
  wsStatus: WsStatus;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  useEffect(() => {
    if (autoScrollRef.current) {
      const el = containerRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [comments.length]);

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 lg:hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">コメント</p>
        <WsStatusBadge status={wsStatus} />
      </div>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="h-72 overflow-y-auto space-y-1.5 p-3"
      >
        <CommentItems comments={comments} />
      </div>
    </div>
  );
}

// ─── WebSocket hook ───────────────────────────────────────────────────────────

function toNum(v: number | string | null | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function useComments(bcsvrKey: string | null, initialComments: RoomComment[]) {
  const [comments, setComments] = useState<RoomComment[]>(initialComments);
  const [wsStatus, setWsStatus] = useState<WsStatus>(
    bcsvrKey ? "connecting" : "disconnected",
  );

  useEffect(() => {
    if (!bcsvrKey) return;

    const ws = new WebSocket(SHOWROOM_SOCKET_URL);
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    ws.addEventListener("open", () => {
      setWsStatus("connected");
      ws.send(createShowroomSubscribeMessage(bcsvrKey));
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(SHOWROOM_SOCKET_PING_MESSAGE);
        }
      }, PING_INTERVAL_MS);
    });

    ws.addEventListener("message", (event: MessageEvent<string>) => {
      const jsonText = getShowroomSocketPayloadText(event.data, bcsvrKey);
      if (!jsonText) return;

      try {
        const msg = JSON.parse(jsonText) as RealtimeMessage;
        if (toNum(msg.t) !== 1) return;

        const text = msg.cm?.trim() ?? "";
        if (!text) return;

        const userId = msg.u;
        const createdAt = toNum(msg.created_at) ?? Math.floor(Date.now() / 1000);

        const newComment: RoomComment = {
          id: `ws-${String(userId ?? "guest")}-${createdAt}-${Math.random()}`,
          avatarId: toNum(msg.av),
          avatarUrl: null,
          classLevel: toNum(msg.cl),
          createdAt,
          name: msg.ac?.trim() || "Unknown",
          text,
          userId: userId != null ? String(userId) : null,
        };

        setComments((prev) => {
          const next = [...prev, newComment];
          return next.length > MAX_COMMENTS ? next.slice(-MAX_COMMENTS) : next;
        });
      } catch {
        // ignore malformed messages
      }
    });

    ws.addEventListener("close", () => {
      setWsStatus("disconnected");
      if (pingTimer) clearInterval(pingTimer);
    });

    ws.addEventListener("error", () => ws.close());

    return () => {
      if (pingTimer) clearInterval(pingTimer);
      ws.close();
    };
  }, [bcsvrKey]);

  return { comments, wsStatus };
}

// ─── Offline fallback ─────────────────────────────────────────────────────────

function RoomOffline({ roomId }: { roomId: number }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl bg-white p-8 text-center">
      <Radio className="h-10 w-10 text-slate-300" aria-hidden />
      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-700">配信が見つかりません</p>
        <p className="text-sm text-slate-500">
          ルーム ID {roomId} の配信は終了しているか、存在しません。
        </p>
      </div>
      <Link
        href="/showtube"
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        一覧へ戻る
      </Link>
    </div>
  );
}

function defaultStreamingId(urls: HlsStreamingUrl[]): number | null {
  return urls.find((u) => u.quality === 0)?.id ?? urls[0]?.id ?? null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShowTubeWatchPage({
  item,
  roomId,
  streamingUrls,
  initialComments,
  bcsvrKey,
}: {
  item: OnliveItem | null;
  roomId: number;
  streamingUrls: HlsStreamingUrl[];
  initialComments: RoomComment[];
  bcsvrKey: string | null;
}) {
  const initialId = defaultStreamingId(streamingUrls);
  const [selectedId, setSelectedId] = useState<number | null>(initialId);

  const selectedUrl =
    streamingUrls.find((u) => u.id === selectedId)?.url ?? null;

  const { comments, wsStatus } = useComments(bcsvrKey, initialComments);

  // 動画の実際の高さを計測してコメントパネルに同期する
  const videoRef = useRef<HTMLDivElement>(null);
  const [videoHeight, setVideoHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      setVideoHeight(el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!item) {
    return <RoomOffline roomId={roomId} />;
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── 上段: 動画 | コメント ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* 動画 */}
        <div className="min-w-0 flex-1">
          <div
            ref={videoRef}
            className="aspect-video overflow-hidden rounded-xl bg-black shadow"
          >
            {selectedUrl ? (
              <HlsPlayer key={selectedUrl} url={selectedUrl} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                ストリーム URL が取得できませんでした
              </div>
            )}
          </div>
        </div>

        {/* PC コメント（動画と同じ高さ） */}
        <CommentPanelDesktop
          comments={comments}
          wsStatus={wsStatus}
          height={videoHeight}
        />
      </div>

      {/* ── モバイルのみ: コメント ────────────────────────────────────────── */}
      <CommentPanelMobile comments={comments} wsStatus={wsStatus} />

      {/* ── 下段: 画質選択 → ルーム情報（動画の下） ────────────────────── */}
      <div className="space-y-3">

        {/* 画質 + 戻るボタン */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {streamingUrls.length > 0 && selectedId !== null ? (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">画質</p>
              <QualitySelector
                options={streamingUrls}
                selectedId={selectedId}
                onChange={setSelectedId}
              />
            </div>
          ) : (
            <div />
          )}
          <Link
            href="/showtube"
            className="hidden lg:flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            一覧へ戻る
          </Link>
        </div>

        {/* ルーム情報 */}
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
          <p className="text-base font-semibold text-slate-900">{item.mainName}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" aria-hidden />
              <span className="font-medium text-slate-700">{item.roomId}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              <span className="font-medium text-slate-700">
                {item.viewNum.toLocaleString()}
              </span>
            </span>
          </div>
          {item.telop && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {item.telop}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {item.genreName}
            </span>
            {item.isKaraoke && (
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                カラオケ
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
