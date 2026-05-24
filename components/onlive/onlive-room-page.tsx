"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Clock3,
  Code2,
  Eye,
  ExternalLink,
  Gem,
  type LucideIcon,
  Minus,
  ShieldCheck,
  ShieldX,
  Timer,
  Users,
} from "lucide-react";

import type {
  RoomComment,
  RoomGiftDefinition,
  RoomGiftLog,
  RoomLiveInfo,
  RoomLiveRankingUser,
  RoomProfile,
  RoomTotalRankingUser,
  RoomUserProfile,
} from "@/lib/showroom";
import {
  createShowroomSubscribeMessage,
  getShowroomSocketPayloadText,
  SHOWROOM_SOCKET_PING_MESSAGE,
  SHOWROOM_SOCKET_URL,
} from "@/lib/showroom-realtime";
import { filterBlockedShowroomItems } from "@/lib/showroom-block-filter";
import { DEVELOPER_USER_ID } from "@/lib/showroom-users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/navigation/app-sidebar";
import { toJstIsoString } from "@/lib/jst";
import { writeOnliveLocalLog, type OnliveLocalLog } from "@/lib/onlive-local-log";
import { useUserBlocks } from "@/hooks/use-user-blocks";
import type { ProfileTarget, ProfileView } from "@/hooks/use-user-profile";
import { cn } from "@/lib/utils";

const POLLING_INTERVAL_MS = 60_000;
const ONLIVE_SOCKET_PING_INTERVAL_MS = 60_000;
const GIFT_LOG_MERGE_WINDOW_SECONDS = 30;
const ONLIVE_LOG_VERSION = 1;
const ONLIVE_STORAGE_VERSION = 1;
const ONLIVE_STORAGE_KEY_PREFIX = "watchlog:onlive";
const DEDUPE_SEPARATOR = "\u001f";
const EMPTY_BLOCKED_USER_IDS = new Set<string>();

type CommentRow = RoomComment & {
  notice: boolean;
  noticeTone: NoticeTone | null;
  telop: boolean;
  timeLabel: string;
  titleLabel: string;
  userVisitStatus: number | null;
};

type NoticeTone =
  | "follow"
  | "fanLevel"
  | "fanCount"
  | "visit"
  | "firstVisit"
  | "ranking";

type UserProfileResponse = {
  profile: RoomUserProfile;
};

type OnliveInitOkResponse = {
  status: "ok";
  roomId: number;
  isPremium: boolean;
  liveInfo: RoomLiveInfo | null;
  giftDefinitions: RoomGiftDefinition[];
  comments: RoomComment[];
  gifts: RoomGiftLog[];
  telop: string | null;
};

type OnlivePollResponse = {
  profile: RoomProfile | null;
  profileHasError: boolean;
  liveRanking: RoomLiveRankingUser[];
  liveRankingHasError: boolean;
  totalRanking: RoomTotalRankingUser[];
  totalRankingHasError: boolean;
};

type GiftTotals = {
  freePoints: number;
  paidPoints: number;
  totalPoints: number;
};

type OnliveStoredMetrics = {
  giftTotals: GiftTotals;
  initialFollowerNum: string | null;
  latestFollowerNum: string | null;
  latestAudienceNum: number | null;
  previousAudienceNum: number | null;
};

type OnliveStorageSnapshot = {
  comments: CommentRow[];
  gifts: RoomGiftLog[];
  liveId: string | null;
  metrics: OnliveStoredMetrics;
  roomId: number;
  savedAt: number;
  version: typeof ONLIVE_STORAGE_VERSION;
};

type OnliveLogPayload = {
  capturedAt: string;
  comments: CommentRow[];
  gifts: RoomGiftLog[];
  liveInfo: {
    endedAt: number | null;
    liveId: string | null;
    liveStatus: number | null;
    startedAt: number | null;
    telop: string | null;
  };
  localStorageSnapshot: OnliveStorageSnapshot | null;
  metrics: OnliveStoredMetrics;
  rankings: {
    live: RoomLiveRankingUser[];
  };
  roomProfile: RoomProfile | null;
  roomId: number;
  savedAt: string;
  source: "onlive-end";
  version: typeof ONLIVE_LOG_VERSION;
};

export type OnliveLogViewerData = {
  capturedAt: string;
  createdAt: string;
  id: string;
  liveId: string;
  liveStartedAt: number | null;
  log: Record<string, unknown>;
  room: {
    imageUrl: string | null;
    roomId: string;
    roomName: string | null;
    roomUrl: string;
  } | null;
  roomId: string;
  updatedAt: string;
};

type OpenProfileHandler = (userId: string, userName: string) => void;

type MetricDelta = {
  badgeClassName: string;
  icon: ReactNode;
  label: string;
};

type ShowroomRealtimeMessage = {
  ac?: string | null;
  av?: number | string | null;
  cl?: number | string | null;
  cm?: string | null;
  created_at?: number | string | null;
  g?: number | string | null;
  gt?: number | string | null;
  m?: string | null;
  message?: string | null;
  n?: number | string | null;
  t?: number | string | null;
  telop?: string | null;
  u?: number | string | null;
  ua?: number | string | null;
};

function getAvatarLabel(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() || "?";
}

function formatClassLevel(classLevel: number | null): string {
  return classLevel === null ? "Class --" : `Class ${classLevel}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatProfileLevel(value: number | null): string {
  return value === null ? "--" : formatNumber(value);
}

function formatOptionalMetric(value: number | null, suffix = ""): string {
  return value === null ? "--" : `${formatNumber(value)}${suffix}`;
}

function getJstDateParts(unixSeconds: number | null) {
  if (!unixSeconds) {
    return null;
  }

  const date = new Date(unixSeconds * 1000 + 9 * 60 * 60 * 1000);

  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    day: String(date.getUTCDate()).padStart(2, "0"),
    hour: String(date.getUTCHours()).padStart(2, "0"),
    minute: String(date.getUTCMinutes()).padStart(2, "0"),
    second: String(date.getUTCSeconds()).padStart(2, "0"),
  };
}

function formatCommentTime(unixSeconds: number | null): string {
  const parts = getJstDateParts(unixSeconds);

  if (!parts) {
    return "--時--分--秒";
  }

  return `${parts.hour}時${parts.minute}分${parts.second}秒`;
}

function formatCommentTitle(unixSeconds: number | null): string {
  const parts = getJstDateParts(unixSeconds);

  if (!parts) {
    return "Unknown time";
  }

  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatLiveEndedNoticeText(unixSeconds: number): string {
  const parts = getJstDateParts(unixSeconds);

  if (!parts) {
    return "配信が終了しました";
  }

  return `${parts.year}年${parts.month}月${parts.day}日${parts.hour}時${parts.minute}分${parts.second}秒に配信が終了しました`;
}

function normalizeComments(items: RoomComment[]): CommentRow[] {
  return items.map((item) => ({
    ...item,
    notice: false,
    noticeTone: null,
    telop: false,
    timeLabel: formatCommentTime(item.createdAt),
    titleLabel: formatCommentTitle(item.createdAt),
    userVisitStatus: null,
  }));
}

function toLiveNumber(
  value: number | string | null | undefined
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toLiveString(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function getShowroomAvatarUrl(avatarId: number | null): string | null {
  return avatarId === null
    ? null
    : `https://image.showroom-cdn.com/showroom-prod/image/avatar/${avatarId}.png`;
}

function getShowroomGiftImageUrl(giftId: number | null): string | null {
  return giftId === null
    ? null
    : `https://image.showroom-cdn.com/showroom-prod/assets/img/gift/${giftId}_s.png`;
}

function createEmptyGiftTotals(): GiftTotals {
  return {
    freePoints: 0,
    paidPoints: 0,
    totalPoints: 0,
  };
}

function createEmptyOnliveStoredMetrics(): OnliveStoredMetrics {
  return {
    giftTotals: createEmptyGiftTotals(),
    initialFollowerNum: null,
    latestFollowerNum: null,
    latestAudienceNum: null,
    previousAudienceNum: null,
  };
}

function getOnliveStorageKey(roomId: number): string {
  return `${ONLIVE_STORAGE_KEY_PREFIX}:${roomId}`;
}

function getOnliveStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStoredString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getStoredNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStoredNoticeTone(value: unknown): NoticeTone | null {
  return value === "follow" ||
    value === "fanLevel" ||
    value === "fanCount" ||
    value === "visit" ||
    value === "firstVisit" ||
    value === "ranking"
    ? value
    : null;
}

function reviveStoredCommentRows(items: readonly unknown[]): CommentRow[] {
  const rows: CommentRow[] = [];

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }

    const id = getStoredString(item.id);
    const name = getStoredString(item.name);
    const text = getStoredString(item.text);

    if (!id || !name || !text) {
      continue;
    }

    const createdAt = getStoredNumber(item.createdAt);

    rows.push({
      id,
      avatarId: getStoredNumber(item.avatarId),
      avatarUrl: getStoredString(item.avatarUrl),
      classLevel: getStoredNumber(item.classLevel),
      createdAt,
      name,
      notice: item.notice === true,
      noticeTone: getStoredNoticeTone(item.noticeTone),
      telop: item.telop === true,
      text,
      timeLabel: formatCommentTime(createdAt),
      titleLabel: formatCommentTitle(createdAt),
      userId: getStoredString(item.userId),
      userVisitStatus: getStoredNumber(item.userVisitStatus),
    });
  }

  return rows;
}

function reviveStoredGiftLogs(items: readonly unknown[]): RoomGiftLog[] {
  const rows: RoomGiftLog[] = [];

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }

    const id = getStoredString(item.id);
    const count = getStoredNumber(item.count);
    const giftName = getStoredString(item.giftName);
    const userName = getStoredString(item.userName);

    if (!id || count === null || !giftName || !userName) {
      continue;
    }

    rows.push({
      id,
      avatarId: getStoredNumber(item.avatarId),
      avatarUrl: getStoredString(item.avatarUrl),
      count,
      createdAt: getStoredNumber(item.createdAt),
      giftId: getStoredNumber(item.giftId),
      giftImageUrl: getStoredString(item.giftImageUrl),
      giftName,
      isFree: typeof item.isFree === "boolean" ? item.isFree : null,
      point: getStoredNumber(item.point),
      totalPoint: getStoredNumber(item.totalPoint),
      userId: getStoredString(item.userId),
      userImageUrl: getStoredString(item.userImageUrl),
      userName,
      userVisitStatus: getStoredNumber(item.userVisitStatus),
    });
  }

  return rows;
}

function normalizeStoredGiftTotals(value: unknown): GiftTotals {
  if (!isRecord(value)) {
    return createEmptyGiftTotals();
  }

  const freePoints = getStoredNumber(value.freePoints) ?? 0;
  const paidPoints = getStoredNumber(value.paidPoints) ?? 0;
  const totalPoints =
    getStoredNumber(value.totalPoints) ?? freePoints + paidPoints;

  return {
    freePoints,
    paidPoints,
    totalPoints,
  };
}

function normalizeStoredMetrics(value: unknown): OnliveStoredMetrics {
  if (!isRecord(value)) {
    return createEmptyOnliveStoredMetrics();
  }

  return {
    giftTotals: normalizeStoredGiftTotals(value.giftTotals),
    initialFollowerNum: getStoredString(value.initialFollowerNum),
    latestFollowerNum: getStoredString(value.latestFollowerNum),
    latestAudienceNum: getStoredNumber(value.latestAudienceNum),
    previousAudienceNum: getStoredNumber(value.previousAudienceNum),
  };
}

function createOnliveStorageSnapshot(
  roomId: number,
  liveId: string | null
): OnliveStorageSnapshot {
  return {
    comments: [],
    gifts: [],
    liveId,
    metrics: createEmptyOnliveStoredMetrics(),
    roomId,
    savedAt: Date.now(),
    version: ONLIVE_STORAGE_VERSION,
  };
}

function readOnliveStorageSnapshot(
  roomId: number,
  liveId: string | null
): OnliveStorageSnapshot | null {
  const storage = getOnliveStorage();

  if (!storage) {
    return null;
  }

  const storageKey = getOnliveStorageKey(roomId);
  const rawSnapshot = storage.getItem(storageKey);

  if (!rawSnapshot) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSnapshot) as unknown;

    if (!isRecord(parsed)) {
      storage.removeItem(storageKey);
      return null;
    }

    const storedLiveId = getStoredString(parsed.liveId);

    if (
      parsed.version !== ONLIVE_STORAGE_VERSION ||
      getStoredNumber(parsed.roomId) !== roomId
    ) {
      storage.removeItem(storageKey);
      return null;
    }

    if (storedLiveId !== liveId) {
      if (liveId !== null) {
        storage.removeItem(storageKey);
      }

      return null;
    }

    return {
      comments: mergeCommentRows(
        Array.isArray(parsed.comments)
          ? reviveStoredCommentRows(parsed.comments)
          : []
      ),
      gifts: mergeGiftLogs(
        Array.isArray(parsed.gifts) ? reviveStoredGiftLogs(parsed.gifts) : []
      ),
      liveId,
      metrics: normalizeStoredMetrics(parsed.metrics),
      roomId,
      savedAt: getStoredNumber(parsed.savedAt) ?? Date.now(),
      version: ONLIVE_STORAGE_VERSION,
    };
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

function updateOnliveStorageSnapshot(
  roomId: number,
  liveId: string | null,
  updateSnapshot: (snapshot: OnliveStorageSnapshot) => OnliveStorageSnapshot
) {
  const storage = getOnliveStorage();

  if (!storage) {
    return;
  }

  const currentSnapshot =
    readOnliveStorageSnapshot(roomId, liveId) ??
    createOnliveStorageSnapshot(roomId, liveId);
  const nextSnapshot = updateSnapshot(currentSnapshot);
  const normalizedSnapshot: OnliveStorageSnapshot = {
    ...nextSnapshot,
    comments: mergeCommentRows(nextSnapshot.comments),
    gifts: mergeGiftLogs(nextSnapshot.gifts),
    liveId,
    roomId,
    savedAt: Date.now(),
    version: ONLIVE_STORAGE_VERSION,
  };

  try {
    storage.setItem(
      getOnliveStorageKey(roomId),
      JSON.stringify(normalizedSnapshot)
    );
  } catch {
    // Storage can fail in private mode or when the quota is full.
  }
}

function removeOnliveStorageSnapshot(roomId: number) {
  const storage = getOnliveStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(getOnliveStorageKey(roomId));
}

function getCommentDuplicateKey(item: CommentRow): string | null {
  if (!item.text || item.createdAt === null) {
    return null;
  }

  const kind = item.telop
    ? "telop"
    : item.notice
      ? `notice:${item.noticeTone ?? "info"}`
      : "comment";

  return [
    kind,
    item.userId ?? "",
    item.name,
    item.createdAt,
    item.text,
  ].join(DEDUPE_SEPARATOR);
}

function getGiftDuplicateKey(item: RoomGiftLog): string | null {
  if (
    item.userId === null ||
    item.giftId === null ||
    item.createdAt === null
  ) {
    return null;
  }

  return [
    item.userId,
    item.giftId,
    item.createdAt,
    item.count,
    item.point ?? "",
    item.totalPoint ?? "",
    item.isFree === null ? "" : String(item.isFree),
  ].join(DEDUPE_SEPARATOR);
}

function mergeCommentRows(
  ...groups: readonly (readonly CommentRow[])[]
): CommentRow[] {
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  const rows: CommentRow[] = [];

  for (const group of groups) {
    for (const item of group) {
      const duplicateKey = getCommentDuplicateKey(item);

      if (
        seenIds.has(item.id) ||
        (duplicateKey !== null && seenContent.has(duplicateKey))
      ) {
        continue;
      }

      seenIds.add(item.id);
      if (duplicateKey !== null) {
        seenContent.add(duplicateKey);
      }
      rows.push(item);
    }
  }

  return rows;
}

function mergeGiftLogs(
  ...groups: readonly (readonly RoomGiftLog[])[]
): RoomGiftLog[] {
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  const lastGiftByUserAndGift = new Map<
    string,
    { boundaryCreatedAt: number; index: number }
  >();
  const rows: RoomGiftLog[] = [];

  for (const group of groups) {
    for (const item of group) {
      const duplicateKey = getGiftDuplicateKey(item);

      if (
        seenIds.has(item.id) ||
        (duplicateKey !== null && seenContent.has(duplicateKey))
      ) {
        continue;
      }

      seenIds.add(item.id);
      if (duplicateKey !== null) {
        seenContent.add(duplicateKey);
      }

      if (
        item.userId !== null &&
        item.giftId !== null &&
        item.createdAt !== null
      ) {
        const mergeKey = `${item.userId}:${item.giftId}`;
        const previous = lastGiftByUserAndGift.get(mergeKey);

        if (
          previous &&
          Math.abs(previous.boundaryCreatedAt - item.createdAt) <=
          GIFT_LOG_MERGE_WINDOW_SECONDS
        ) {
          const mergedItem = rows[previous.index];
          const count = mergedItem.count + item.count;

          rows[previous.index] = {
            ...mergedItem,
            count,
            totalPoint: getRealtimeGiftTotalPoint(
              mergedItem.isFree,
              mergedItem.point,
              count
            ),
          };
          const mergedDuplicateKey = getGiftDuplicateKey(rows[previous.index]);

          if (mergedDuplicateKey !== null) {
            seenContent.add(mergedDuplicateKey);
          }
          lastGiftByUserAndGift.set(mergeKey, {
            boundaryCreatedAt: item.createdAt,
            index: previous.index,
          });
          continue;
        }

        lastGiftByUserAndGift.set(mergeKey, {
          boundaryCreatedAt: item.createdAt,
          index: rows.length,
        });
      }

      rows.push(item);
    }
  }

  return rows;
}

function isFreeGiftLog(item: Pick<RoomGiftLog, "isFree">): boolean {
  return item.isFree === true;
}

function isPaidGiftLog(item: Pick<RoomGiftLog, "isFree">): boolean {
  return item.isFree === false;
}

function calculateGiftTotalPoint(
  point: number | null,
  count: number
): number | null {
  if (point === null) {
    return null;
  }

  return (point === 0 ? 1 : point) * count;
}

function getGiftSummaryPoint(
  item: Pick<RoomGiftLog, "count" | "isFree" | "point" | "totalPoint">
): number | null {
  if (isFreeGiftLog(item)) {
    return item.totalPoint ?? calculateGiftTotalPoint(item.point, item.count);
  }

  if (typeof item.point === "number" && item.point > 0) {
    return item.totalPoint ?? item.point * item.count;
  }

  return item.totalPoint;
}

function getRealtimeGiftTotalPoint(
  isFree: boolean | null,
  point: number | null,
  count: number
): number | null {
  if (isFree === true) {
    return calculateGiftTotalPoint(point, count) ?? count;
  }

  return typeof point === "number" && point > 0 ? point * count : null;
}

function toGiftDefinitionMap(
  definitions: readonly RoomGiftDefinition[]
): Map<number, RoomGiftDefinition> {
  return new Map(definitions.map((item) => [item.giftId, item]));
}

function parseShowroomSocketMessage(
  rawMessage: string,
  bcsvrKey: string
): ShowroomRealtimeMessage | null {
  const jsonText = getShowroomSocketPayloadText(rawMessage, bcsvrKey);

  if (!jsonText || !jsonText.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;

    return parsed && typeof parsed === "object"
      ? (parsed as ShowroomRealtimeMessage)
      : null;
  } catch {
    return null;
  }
}

function normalizeRealtimeComment(
  message: ShowroomRealtimeMessage,
  sequence: number
): CommentRow | null {
  const text = message.cm?.trim();

  if (toLiveNumber(message.t) !== 1 || !text) {
    return null;
  }

  const createdAt = toLiveNumber(message.created_at) ?? Math.floor(Date.now() / 1000);
  const userId = toLiveString(message.u);
  const avatarId = toLiveNumber(message.av);
  const name = message.ac?.trim() || "Unknown";

  return {
    id: `live-comment-${userId ?? "guest"}-${createdAt}-${sequence}`,
    avatarId,
    avatarUrl: getShowroomAvatarUrl(avatarId),
    classLevel: toLiveNumber(message.cl),
    createdAt,
    name,
    notice: false,
    noticeTone: null,
    telop: false,
    text,
    timeLabel: formatCommentTime(createdAt),
    titleLabel: formatCommentTitle(createdAt),
    userId,
    userVisitStatus: toLiveNumber(message.ua),
  };
}

function normalizeRealtimeNotice(
  message: ShowroomRealtimeMessage,
  sequence: number
): CommentRow | null {
  const messageType = toLiveNumber(message.t);
  const text =
    messageType === 1001 ? message.message?.trim() : message.m?.trim();
  const noticeTone = getRealtimeNoticeTone(messageType, text);

  if (!text || noticeTone === null) {
    return null;
  }

  const createdAt = toLiveNumber(message.created_at) ?? Math.floor(Date.now() / 1000);
  const userId = toLiveString(message.u);

  return {
    id: `live-notice-${noticeTone}-${createdAt}-${sequence}`,
    avatarId: null,
    avatarUrl: null,
    classLevel: null,
    createdAt,
    name: getRealtimeNoticeUserName(noticeTone, text) ?? "お知らせ",
    notice: true,
    noticeTone,
    telop: false,
    text,
    timeLabel: formatCommentTime(createdAt),
    titleLabel: formatCommentTitle(createdAt),
    userId,
    userVisitStatus: null,
  };
}

function getRealtimeNoticeTone(
  messageType: number | null,
  text: string | null | undefined
): NoticeTone | null {
  if (!text) {
    return null;
  }

  if (
    messageType === 1001 &&
    text.includes("ランキング「") &&
    text.includes("」で") &&
    text.includes("位になりました")
  ) {
    return "ranking";
  }

  if (messageType !== 18) {
    return null;
  }

  if (text.includes("さんがフォローしました！❤")) {
    return "follow";
  }

  if (
    text.includes("のファンレベルが") &&
    text.includes("にあがりました！")
  ) {
    return "fanLevel";
  }

  if (/^.+が[0-9０-９,，]+人になりました[！!]$/.test(text)) {
    return "fanCount";
  }

  if (
    text.includes("さんが初訪問✨") ||
    text.includes("さんが2度目の訪問✨")
  ) {
    return "firstVisit";
  }

  if (text.includes("回目の訪問🎉")) {
    return "visit";
  }

  return null;
}

function getRealtimeNoticeUserName(
  noticeTone: NoticeTone,
  text: string
): string | null {
  const patterns: Partial<Record<NoticeTone, RegExp>> = {
    fanCount: /^(.+)が[0-9０-９,，]+人になりました[！!]$/,
    fanLevel: /^(.+)のファンレベルが/,
    firstVisit: /^(.+)さんが(?:初訪問|2度目の訪問)/,
    follow: /^(.+)さんがフォローしました！❤$/,
    visit: /^(.+)さんが\d+回目の訪問🎉$/,
  };
  const match = patterns[noticeTone]?.exec(text);
  const name = match?.[1]?.trim();

  return name && name.length > 0 ? name : null;
}

function normalizeLiveEndedNotice(
  message: ShowroomRealtimeMessage,
  sequence: number
): CommentRow {
  const createdAt = toLiveNumber(message.created_at) ?? Math.floor(Date.now() / 1000);
  const text = formatLiveEndedNoticeText(createdAt);

  return {
    id: `live-notice-ended-${createdAt}-${sequence}`,
    avatarId: null,
    avatarUrl: null,
    classLevel: null,
    createdAt,
    name: "お知らせ",
    notice: true,
    noticeTone: null,
    telop: false,
    text,
    timeLabel: formatCommentTime(createdAt),
    titleLabel: formatCommentTitle(createdAt),
    userId: null,
    userVisitStatus: null,
  };
}

function normalizeRealtimeGift(
  message: ShowroomRealtimeMessage,
  sequence: number,
  giftDefinitions: ReadonlyMap<number, RoomGiftDefinition>
): RoomGiftLog | null {
  const giftId = toLiveNumber(message.g);

  if (toLiveNumber(message.t) !== 2 || giftId === null) {
    return null;
  }

  const createdAt = toLiveNumber(message.created_at) ?? Math.floor(Date.now() / 1000);
  const count = toLiveNumber(message.n) ?? 1;
  const giftType = toLiveNumber(message.gt);
  const giftMeta = giftDefinitions.get(giftId);
  const metaPoint = giftMeta?.point ?? null;
  const isFree =
    giftMeta?.isFree === true
      ? true
      : giftType === 2 || (typeof metaPoint === "number" && metaPoint > 0)
        ? false
        : null;
  const giftPoint =
    isFree === true ? metaPoint ?? 0 : isFree === false ? metaPoint : null;
  const totalPoint = getRealtimeGiftTotalPoint(isFree, giftPoint, count);
  const userId = toLiveString(message.u);
  const avatarId = toLiveNumber(message.av);

  return {
    id: `live-gift-${userId ?? "guest"}-${giftId}-${createdAt}-${sequence}`,
    avatarId,
    avatarUrl: getShowroomAvatarUrl(avatarId),
    count,
    createdAt,
    giftId,
    giftImageUrl: giftMeta?.giftImageUrl ?? getShowroomGiftImageUrl(giftId),
    giftName: giftMeta?.giftName ?? `Gift #${giftId}`,
    isFree,
    point: giftPoint,
    totalPoint,
    userId,
    userImageUrl: null,
    userName: message.ac?.trim() || "Unknown",
    userVisitStatus: toLiveNumber(message.ua),
  };
}

function formatGiftMeta(
  item: Pick<RoomGiftLog, "count" | "point" | "totalPoint" | "createdAt">
): string {
  const parts = [`x ${formatNumber(item.count)}`];
  const unitPoint = item.point === 0 ? 1 : item.point;
  const totalPoint =
    item.totalPoint ?? calculateGiftTotalPoint(item.point, item.count);

  if (typeof unitPoint === "number") {
    parts.push(`${formatNumber(unitPoint)} pt`);
  }

  if (typeof totalPoint === "number" && totalPoint > 0) {
    parts.push(`${formatNumber(totalPoint)} pt`);
  }

  parts.push(formatCommentTime(item.createdAt));

  return parts.join(" / ");
}

function summarizeGiftTotals(items: readonly RoomGiftLog[]): GiftTotals {
  return items.reduce<GiftTotals>(
    (totals, item) => {
      if (isFreeGiftLog(item)) {
        totals.freePoints += getGiftSummaryPoint(item) ?? item.count;
      }

      if (isPaidGiftLog(item)) {
        totals.paidPoints += getGiftSummaryPoint(item) ?? 0;
      }

      totals.totalPoints = totals.freePoints + totals.paidPoints;

      return totals;
    },
    {
      freePoints: 0,
      paidPoints: 0,
      totalPoints: 0,
    }
  );
}

function formatMetricValue({
  hasError,
  isLoading,
  suffix = "",
  value,
}: {
  hasError: boolean;
  isLoading: boolean;
  suffix?: string;
  value: number | null;
}): string {
  if (hasError) {
    return "--";
  }

  if (isLoading) {
    return "...";
  }

  if (value === null) {
    return "--";
  }

  return `${formatNumber(value)}${suffix}`;
}

function formatTextMetricValue({
  hasError,
  isLoading,
  value,
}: {
  hasError: boolean;
  isLoading: boolean;
  value: string | null;
}): string {
  if (hasError) {
    return "--";
  }

  if (isLoading) {
    return "...";
  }

  return value ?? "--";
}

function parseMetricNumber(
  value: number | string | null | undefined
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replaceAll(",", ""));
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

function formatMetricDelta({
  comparisonLabel = "1分前比",
  currentValue,
  hasError,
  isLoading,
  previousValue,
  suffix = "",
}: {
  comparisonLabel?: string;
  currentValue: number | null;
  hasError: boolean;
  isLoading: boolean;
  previousValue: number | null;
  suffix?: string;
}): MetricDelta {
  if (
    hasError ||
    isLoading ||
    currentValue === null ||
    previousValue === null
  ) {
    return {
      badgeClassName: "bg-slate-100 text-slate-500",
      icon: <Minus className="h-3.5 w-3.5" />,
      label: `${comparisonLabel} --`,
    };
  }

  const delta = currentValue - previousValue;
  const prefix = delta >= 0 ? "+" : "-";
  const badgeClassName =
    delta > 0
      ? "bg-emerald-50 text-emerald-700"
      : delta < 0
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-500";
  const icon =
    delta > 0 ? (
      <ArrowUpRight className="h-3.5 w-3.5" />
    ) : delta < 0 ? (
      <ArrowDownRight className="h-3.5 w-3.5" />
    ) : (
      <Minus className="h-3.5 w-3.5" />
    );

  return {
    badgeClassName,
    icon,
    label: `${comparisonLabel} ${prefix}${formatNumber(Math.abs(delta))}${suffix}`,
  };
}

function formatLiveStartedClock(unixSeconds: number | null): string {
  const parts = getJstDateParts(unixSeconds);

  if (!parts) {
    return "--時--分--秒";
  }

  return `${parts.hour}時${parts.minute}分${parts.second}秒`;
}

function formatLiveStartedDate(unixSeconds: number | null): string {
  const parts = getJstDateParts(unixSeconds);

  if (!parts) {
    return "----年--月--日";
  }

  return `${parts.year}年${parts.month}月${parts.day}日`;
}

function formatElapsedTime(unixSeconds: number | null, nowMs: number): string {
  if (!unixSeconds) {
    return "--時--分--秒";
  }

  const elapsedSeconds = Math.max(0, Math.floor(nowMs / 1000) - unixSeconds);
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return `${String(hours).padStart(2, "0")}時${String(minutes).padStart(2, "0")}分${String(seconds).padStart(2, "0")}秒`;
}

function filterComments(
  items: readonly CommentRow[],
  showNotice: boolean
): CommentRow[] {
  return items.filter((item) => (showNotice ? true : !item.notice));
}

function getCommentRowClassName(comment: CommentRow): string {
  const noticeClassName =
    comment.noticeTone === "fanLevel" || comment.noticeTone === "firstVisit"
      ? "bg-sky-50/70"
      : comment.noticeTone === "fanCount"
        ? "bg-pink-50/70"
        : comment.noticeTone === "ranking"
          ? "bg-yellow-50/80"
          : comment.noticeTone === "visit"
            ? "bg-emerald-50/70"
            : comment.noticeTone === "follow"
              ? "bg-rose-50/60"
              : comment.notice
                ? "bg-rose-50/60"
                : "bg-white";

  return cn(
    "border-b border-slate-100 align-top hover:bg-slate-50",
    noticeClassName
  );
}

function getUserVisitStatusBadge(
  userId: string | null | undefined,
  userVisitStatus: number | null | undefined
): { className: string; label: string } | null {
  if (userId === DEVELOPER_USER_ID) {
    const label =
      userVisitStatus === 2
        ? "開発者（初見）"
        : userVisitStatus === 1
          ? "開発者（ビギナー）"
          : "開発者";

    return {
      className: "bg-violet-100 text-violet-700 ring-violet-200",
      label,
    };
  }

  if (userVisitStatus === 2) {
    return {
      className: "bg-sky-100 text-sky-700 ring-sky-200",
      label: "初見",
    };
  }

  if (userVisitStatus === 1) {
    return {
      className: "bg-emerald-100 text-emerald-700 ring-emerald-200",
      label: "ビギナー",
    };
  }

  return null;
}

function UserVisitStatusBadge({
  userId,
  userVisitStatus,
}: {
  userId: string | null | undefined;
  userVisitStatus: number | null | undefined;
}) {
  const badge = getUserVisitStatusBadge(userId, userVisitStatus);

  if (!badge) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-4 ring-1",
        badge.className
      )}
    >
      {badge.label}
    </span>
  );
}

function useRoomGiftLogs(initialGifts: RoomGiftLog[]) {
  const [gifts] = useState(() => initialGifts);
  return { gifts, isLoading: false, hasError: false };
}

function useShowroomRealtimeFeed(
  roomId: number,
  liveInfo: RoomLiveInfo | null,
  giftDefinitions: RoomGiftDefinition[]
) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [gifts, setGifts] = useState<RoomGiftLog[]>([]);
  const [hasFatalError, setHasFatalError] = useState(false);
  const [hasLiveInfo, setHasLiveInfo] = useState(false);
  const [liveEndedAt, setLiveEndedAt] = useState<number | null>(null);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [isLiveEnded, setIsLiveEnded] = useState(false);
  const [liveStatus, setLiveStatus] = useState<number | null>(null);
  const [telop, setTelop] = useState<string | null>(null);
  const hasFatalErrorRef = useRef(false);
  const sequenceRef = useRef(0);
  const restoredSessionRef = useRef<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let socket: WebSocket | null = null;
    let shouldTreatCloseAsError = true;
    let pingIntervalId: number | null = null;
    const controller = new AbortController();

    hasFatalErrorRef.current = false;

    const clearPingInterval = () => {
      if (pingIntervalId !== null) {
        window.clearInterval(pingIntervalId);
        pingIntervalId = null;
      }
    };

    const reportFatalError = () => {
      if (!isActive || hasFatalErrorRef.current) {
        return;
      }

      hasFatalErrorRef.current = true;
      shouldTreatCloseAsError = false;
      clearPingInterval();
      setHasFatalError(true);

      if (
        socket &&
        socket.readyState !== WebSocket.CLOSING &&
        socket.readyState !== WebSocket.CLOSED
      ) {
        socket.close();
      }
    };

    function connect() {
      try {
        if (!liveInfo) {
          reportFatalError();
          return;
        }

        if (!isActive) {
          return;
        }

        const liveSessionId = liveInfo.liveId;
        const liveSessionKey = `${roomId}:${liveSessionId ?? "unknown"}`;

        setHasLiveInfo(true);
        setLiveId(liveSessionId);
        setLiveStatus(liveInfo.liveStatus);

        if (liveInfo.liveStatus === 1) {
          shouldTreatCloseAsError = false;
          removeOnliveStorageSnapshot(roomId);
          return;
        }

        if (restoredSessionRef.current !== liveSessionKey) {
          const storedSnapshot = readOnliveStorageSnapshot(
            roomId,
            liveSessionId
          );

          if (storedSnapshot) {
            setComments((current) =>
              mergeCommentRows(current, storedSnapshot.comments)
            );
            setGifts((current) => mergeGiftLogs(current, storedSnapshot.gifts));
          }

          restoredSessionRef.current = liveSessionKey;
        }

        const giftDefinitionMap = toGiftDefinitionMap(giftDefinitions);
        const bcsvrKey = liveInfo.bcsvrKey?.trim();

        if (!bcsvrKey) {
          throw new Error("Missing bcsvr_key");
        }

        if (!isActive) {
          return;
        }

        const currentSocket = new WebSocket(SHOWROOM_SOCKET_URL);
        socket = currentSocket;

        currentSocket.addEventListener("open", () => {
          try {
            if (!isActive || currentSocket.readyState !== WebSocket.OPEN) {
              return;
            }

            currentSocket.send(createShowroomSubscribeMessage(bcsvrKey));
            pingIntervalId = window.setInterval(() => {
              try {
                if (currentSocket.readyState !== WebSocket.OPEN) {
                  reportFatalError();
                  return;
                }

                currentSocket.send(SHOWROOM_SOCKET_PING_MESSAGE);
              } catch {
                reportFatalError();
              }
            }, ONLIVE_SOCKET_PING_INTERVAL_MS);
          } catch {
            reportFatalError();
          }
        });

        currentSocket.addEventListener("message", (event) => {
          try {
            if (!isActive || typeof event.data !== "string") {
              return;
            }

            const payload = parseShowroomSocketMessage(event.data, bcsvrKey);

            if (!payload) {
              return;
            }

            const nextSequence = sequenceRef.current + 1;
            sequenceRef.current = nextSequence;

            if (toLiveNumber(payload.t) === 101) {
              const liveEndedNotice = normalizeLiveEndedNotice(
                payload,
                nextSequence
              );
              setComments((current) =>
                mergeCommentRows([liveEndedNotice], current)
              );
              setLiveEndedAt(liveEndedNotice.createdAt);
              setIsLiveEnded(true);
              shouldTreatCloseAsError = false;
              currentSocket.close();
              return;
            }

            const comment = normalizeRealtimeComment(payload, nextSequence);
            if (comment) {
              setComments((current) => mergeCommentRows([comment], current));
              return;
            }

            const notice = normalizeRealtimeNotice(payload, nextSequence);
            if (notice) {
              setComments((current) => mergeCommentRows([notice], current));
              return;
            }

            const gift = normalizeRealtimeGift(
              payload,
              nextSequence,
              giftDefinitionMap
            );
            if (gift) {
              setGifts((current) => mergeGiftLogs([gift], current));
              return;
            }

            const nextTelop = payload.telop?.trim();
            if (nextTelop) {
              setTelop(nextTelop);
            }
          } catch {
            reportFatalError();
          }
        });

        currentSocket.addEventListener("error", () => {
          reportFatalError();
        });

        currentSocket.addEventListener("close", () => {
          if (socket === currentSocket) {
            socket = null;
          }

          clearPingInterval();

          if (shouldTreatCloseAsError) {
            reportFatalError();
          }
        });
      } catch (error) {
        if ((error as Error).name === "AbortError" || !isActive) {
          return;
        }

        reportFatalError();
      }
    }

    void connect();

    return () => {
      isActive = false;
      shouldTreatCloseAsError = false;
      controller.abort();
      clearPingInterval();

      socket?.close();
    };
  }, [roomId, liveInfo, giftDefinitions]);

  useEffect(() => {
    if (!hasLiveInfo) {
      return;
    }

    if (liveStatus === 1) {
      removeOnliveStorageSnapshot(roomId);
      return;
    }

    if (isLiveEnded) {
      return;
    }

    updateOnliveStorageSnapshot(roomId, liveId, (snapshot) => ({
      ...snapshot,
      comments: mergeCommentRows(comments, snapshot.comments),
      gifts: mergeGiftLogs(gifts, snapshot.gifts),
    }));
  }, [comments, gifts, hasLiveInfo, isLiveEnded, liveId, liveStatus, roomId]);

  return {
    comments,
    gifts,
    hasFatalError,
    hasLiveInfo,
    isLiveEnded,
    liveEndedAt,
    liveId,
    liveStatus,
    telop,
  };
}

function useOnlivePoll(isEnabled = true) {
  const [profile, setProfile] = useState<RoomProfile | null>(null);
  const [initialProfile, setInitialProfile] = useState<RoomProfile | null>(null);
  const [previousProfile, setPreviousProfile] = useState<RoomProfile | null>(null);
  const [liveRanking, setLiveRanking] = useState<RoomLiveRankingUser[]>([]);
  const [totalRanking, setTotalRanking] = useState<RoomTotalRankingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileHasError, setProfileHasError] = useState(false);
  const [liveRankingHasError, setLiveRankingHasError] = useState(false);
  const [totalRankingHasError, setTotalRankingHasError] = useState(false);
  const latestProfileRef = useRef<RoomProfile | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    let isActive = true;
    let currentController: AbortController | null = null;

    async function loadPollData() {
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;

      try {
        const response = await fetch("/api/onlive/poll", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch poll data");
        }

        const data = (await response.json()) as OnlivePollResponse;

        if (!isActive || controller.signal.aborted) {
          return;
        }

        const prevProfile = latestProfileRef.current;
        setPreviousProfile(prevProfile);
        if (prevProfile === null) {
          setInitialProfile(data.profile);
        }
        latestProfileRef.current = data.profile;
        setProfile(data.profile);
        setLiveRanking(data.liveRanking);
        setTotalRanking(data.totalRanking);
        setProfileHasError(data.profileHasError);
        setLiveRankingHasError(data.liveRankingHasError);
        setTotalRankingHasError(data.totalRankingHasError);
      } catch (error) {
        if ((error as Error).name === "AbortError" || !isActive) {
          return;
        }

        if (latestProfileRef.current === null) {
          setProfileHasError(true);
          setLiveRankingHasError(true);
          setTotalRankingHasError(true);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadPollData();

    const intervalId = window.setInterval(() => {
      void loadPollData();
    }, POLLING_INTERVAL_MS);

    return () => {
      isActive = false;
      currentController?.abort();
      window.clearInterval(intervalId);
    };
  }, [isEnabled]);

  return {
    profile,
    initialProfile,
    previousProfile,
    liveRanking,
    totalRanking,
    isLoading: isEnabled ? isLoading : false,
    profileHasError: isEnabled ? profileHasError : false,
    liveRankingHasError: isEnabled ? liveRankingHasError : false,
    totalRankingHasError: isEnabled ? totalRankingHasError : false,
  };
}

function SectionCard({
  header,
  children,
  className,
  contentClassName,
}: {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("flex min-h-0 flex-col rounded-3xl border-0 shadow-sm", className)}>
      {header ? <CardHeader className="pb-3">{header}</CardHeader> : null}
      <CardContent className={cn("min-h-0 flex-1", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

function useLiveProfile(roomId: number) {
  const { blockedUserIds, blockUser, isLoading: isBlockListLoading } = useUserBlocks();
  const [selectedProfileTarget, setSelectedProfileTarget] = useState<ProfileTarget | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, RoomUserProfile>>({});
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [hasProfileError, setHasProfileError] = useState(false);
  const [profileView, setProfileView] = useState<ProfileView>("user");
  const [isBlockActionPending, setIsBlockActionPending] = useState(false);
  const [blockErrorMessage, setBlockErrorMessage] = useState<string | null>(null);
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
          `/api/room/user-profile?room_id=${roomId}&user_id=${currentTarget.userId}`,
          { cache: "no-store", signal: controller.signal }
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

  const openProfile: OpenProfileHandler = (userId, userName) => {
    setHasProfileError(false);
    setBlockErrorMessage(null);
    setProfileView("user");
    setSelectedProfileTarget({ userId, userName });
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

  const handleBlockUser = async (target: ProfileTarget, profile: RoomUserProfile | null) => {
    setIsBlockActionPending(true);
    setBlockErrorMessage(null);

    try {
      await blockUser(target.userId, profile?.name || target.userName);
    } catch (error) {
      setBlockErrorMessage(
        error instanceof Error ? error.message : "ブロック登録に失敗しました"
      );
    } finally {
      setIsBlockActionPending(false);
    }
  };

  return {
    activeProfile,
    blockedUserIds,
    blockErrorMessage,
    handleBlockUser,
    handleProfileOpenChange,
    isBlockActionPending,
    isBlockListLoading,
    isProfileLoading,
    hasProfileError,
    openProfile,
    profileView,
    selectedProfileTarget,
    setProfileView,
  };
}

function LiveMetricCard({
  footer,
  icon: Icon,
  iconClassName,
  label,
  subValue,
  value,
  valueTitle,
}: {
  footer?: ReactNode;
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  subValue?: ReactNode;
  value: ReactNode;
  valueTitle?: string;
}) {
  return (
    <Card className="rounded-3xl border-0 py-0 shadow-sm">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", iconClassName)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-900" title={valueTitle}>{value}</p>
            {subValue}
          </div>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}

function AvatarVisual({
  avatarUrl,
  className,
  name,
  size = 40,
}: {
  avatarUrl: string | null;
  className?: string;
  name: string;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-slate-100 text-sm font-semibold text-slate-700",
        className
      )}
    >
      {getAvatarLabel(name)}
    </div>
  );
}

function ProfileAvatarButton({
  avatarClassName,
  avatarUrl,
  name,
  onOpenProfile,
  userId,
}: {
  avatarClassName?: string;
  avatarUrl: string | null;
  name: string;
  onOpenProfile: OpenProfileHandler;
  userId: string | null;
}) {
  const avatar = (
    <AvatarVisual
      avatarUrl={avatarUrl}
      className={cn("h-10 w-10", avatarClassName)}
      name={name}
    />
  );

  if (!userId) {
    return avatar;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpenProfile(userId, name);
      }}
      className="shrink-0 cursor-pointer rounded-full transition hover:scale-[1.02] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
      title={`Open ${name} profile`}
    >
      {avatar}
    </button>
  );
}

function MetricDeltaBadge({
  delta,
}: {
  delta: MetricDelta;
}) {
  return (
    <div
      className={cn(
        "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        delta.badgeClassName
      )}
    >
      {delta.icon}
      <span>{delta.label}</span>
    </div>
  );
}

function ProfileMetricCard({
  accentClassName,
  label,
  value,
}: {
  accentClassName: string;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("rounded-3xl border p-4", accentClassName)}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SocialLinksSection({
  emptyMessage,
  items,
}: {
  emptyMessage: string;
  items: {
    icon: string;
    name: string | null;
    url: string;
  }[];
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.length > 0 ? (
        items.map((item) => (
          <a
            key={`${item.icon}-${item.url}`}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
            title={item.name ?? "SNS"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.icon}
              alt={item.name ?? "SNS"}
              width={18}
              height={18}
              className="h-[18px] w-[18px] object-contain"
            />
            <span>{item.name ?? "SNS"}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))
      ) : (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );
}

export function UserProfileModal({
  blockedUserIds = EMPTY_BLOCKED_USER_IDS,
  blockErrorMessage = null,
  hasError,
  isBlockActionPending = false,
  isLoading,
  onBlockUser,
  onOpenChange,
  onViewChange,
  profile,
  target,
  view,
}: {
  blockedUserIds?: ReadonlySet<string>;
  blockErrorMessage?: string | null;
  hasError: boolean;
  isBlockActionPending?: boolean;
  isLoading: boolean;
  onBlockUser?: (target: ProfileTarget, profile: RoomUserProfile | null) => void;
  onOpenChange: (open: boolean) => void;
  onViewChange: (view: ProfileView) => void;
  profile: RoomUserProfile | null;
  target: ProfileTarget | null;
  view: ProfileView;
}) {
  const isOpen = target !== null;
  const displayName = profile?.name || target?.userName || "Unknown";
  const profileImageUrl =
    profile?.imageUrl || "https://static.showroom-live.com/assets/img/no_profile.jpg";
  const avatarImageUrl = profile?.avatarUrl ?? null;
  const roomProfile = profile?.roomProfile ?? null;
  const activeView = view === "room" && roomProfile ? "room" : "user";
  const roomDisplayName =
    roomProfile?.roomName || roomProfile?.mainName || `${displayName} room`;
  const roomImageUrl =
    roomProfile?.imageUrl ||
    roomProfile?.imageSquareUrl ||
    "https://static.showroom-live.com/assets/img/no_profile.jpg";
  const roomAvatarUrl =
    roomProfile?.avatarUrl || roomProfile?.imageSquareUrl || null;
  const roomPrimaryLink = roomProfile?.isOnlive
    ? roomProfile.shareUrlLive || roomProfile.shareUrl
    : roomProfile?.shareUrl;
  const isDeveloperProfile = target?.userId === DEVELOPER_USER_ID;
  const isBlockedProfile = target
    ? blockedUserIds.has(target.userId)
    : false;
  const blockButtonLabel = isDeveloperProfile
    ? "開発者はブロックできません"
    : isBlockedProfile
      ? "ブロック済み"
      : isBlockActionPending
        ? "ブロック中..."
        : "このユーザーをブロック";
  const smsAuthentication = profile?.isSmsAuthenticated
    ? {
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800 ring-emerald-100",
      icon: <ShieldCheck className="h-5 w-5 shrink-0" />,
      label: "SMS認証済み",
      message: "このユーザーはSMS認証済みです。",
    }
    : {
      className: "border-rose-200 bg-rose-50 text-rose-800 ring-rose-100",
      icon: <ShieldX className="h-5 w-5 shrink-0" />,
      label: "SMS未認証",
      message: "このユーザーはSMS未認証です。",
    };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="h-[70vh] max-h-[70vh] w-[90vw] max-w-[90vw] grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-3xl p-0 lg:w-[50vw] lg:max-w-[50vw]">
        <DialogTitle className="sr-only">
          {displayName} profile
        </DialogTitle>
        <DialogDescription className="sr-only">
          Show SHOWROOM user profile details.
        </DialogDescription>

        <div className="min-h-0 overflow-auto p-5 sm:p-6">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="aspect-square w-full animate-pulse rounded-3xl bg-slate-100" />
                <div className="h-20 w-20 animate-pulse rounded-full bg-slate-100" />
                <div className="flex gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-10 w-10 animate-pulse rounded-2xl bg-slate-100"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-20 animate-pulse rounded-2xl bg-slate-100"
                    />
                  ))}
                </div>
                <div className="h-7 w-40 animate-pulse rounded bg-slate-100" />
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-[85%] animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-[70%] animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ) : hasError ? (
            <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">
              プロフィール情報の取得に失敗しました。
            </div>
          ) : profile ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {isDeveloperProfile ? (
                    <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-2xl border border-violet-300 bg-violet-100 px-4 py-2 text-sm font-extrabold text-violet-950 shadow-sm ring-1 ring-violet-200">
                      <Code2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">私がWatchLogの開発者</span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    {activeView === "room" && roomProfile?.isOnlive ? (
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        配信中
                      </span>
                    ) : null}
                    <h2 className="text-lg font-semibold text-slate-950">
                      {activeView === "user" ? displayName : roomDisplayName}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeView === "user"
                      ? "ユーザープロフィール"
                      : "ルームプロフィール"}
                  </p>
                </div>
                {roomProfile ? (
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/80 p-1 shadow-inner">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "rounded-full px-4 transition",
                        activeView === "user"
                          ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                          : "text-slate-500 hover:text-slate-900"
                      )}
                      aria-pressed={activeView === "user"}
                      onClick={() => onViewChange("user")}
                    >
                      ユーザー
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "rounded-full px-4 transition",
                        activeView === "room"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      )}
                      aria-pressed={activeView === "room"}
                      onClick={() => onViewChange("room")}
                    >
                      ルーム
                    </Button>
                  </div>
                ) : null}
              </div>

              {activeView === "user" ? (
                <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profileImageUrl}
                        alt={`${displayName} profile image`}
                        width={480}
                        height={480}
                        className="aspect-square h-auto w-full object-cover"
                      />
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                        Avatar
                      </p>
                      <div className="mt-3">
                        <AvatarVisual
                          avatarUrl={avatarImageUrl}
                          className="h-20 w-20"
                          name={displayName}
                          size={80}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                        SNS
                      </p>
                      <SocialLinksSection
                        items={profile.snsList}
                        emptyMessage="SNS は登録されていません。"
                      />
                    </div>

                    <div
                      className={cn(
                        "rounded-3xl border p-4 shadow-sm ring-1",
                        smsAuthentication.className
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {smsAuthentication.icon}
                        <div>
                          <p className="text-base font-bold">
                            {smsAuthentication.label}
                          </p>
                          <p className="mt-1 text-xs font-medium opacity-80">
                            {smsAuthentication.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {target && onBlockUser ? (
                      <div className="rounded-3xl border border-rose-100 bg-rose-50/70 p-4">
                        <Button
                          type="button"
                          variant="destructive"
                          className="h-10 w-full rounded-2xl"
                          disabled={
                            isDeveloperProfile ||
                            isBlockedProfile ||
                            isBlockActionPending
                          }
                          onClick={() => onBlockUser(target, profile)}
                        >
                          <Ban className="h-4 w-4" aria-hidden />
                          {blockButtonLabel}
                        </Button>
                        {blockErrorMessage ? (
                          <p className="mt-2 text-xs font-medium text-rose-700">
                            {blockErrorMessage}
                          </p>
                        ) : isDeveloperProfile ? (
                          <p className="mt-2 text-xs font-medium text-violet-700">
                            WatchLogの開発者はブロック対象外です。
                          </p>
                        ) : isBlockedProfile ? (
                          <p className="mt-2 text-xs font-medium text-slate-600">
                            ブロックページから解除できます。
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-3">
                      <ProfileMetricCard
                        accentClassName="border-amber-100 bg-amber-50 text-amber-700"
                        label="ファンレベル"
                        value={formatProfileLevel(profile.activeFanLevel)}
                      />
                      <ProfileMetricCard
                        accentClassName="border-sky-100 bg-sky-50 text-sky-700"
                        label="リスナーレベル"
                        value={formatProfileLevel(profile.fanLevel)}
                      />
                      <ProfileMetricCard
                        accentClassName="border-violet-100 bg-violet-50 text-violet-700"
                        label="クラスレベル"
                        value={formatProfileLevel(profile.classLevel)}
                      />
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-semibold text-slate-950">
                          {displayName}
                        </h3>
                        {target?.userId ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            ID: {target.userId}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {profile.description || "プロフィールは未設定です。"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : roomProfile ? (
                <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={roomImageUrl}
                        alt={`${roomDisplayName} room image`}
                        width={480}
                        height={480}
                        className="aspect-square h-auto w-full object-cover"
                      />
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                        Room Icon
                      </p>
                      <div className="mt-3">
                        <AvatarVisual
                          avatarUrl={roomAvatarUrl}
                          className="h-20 w-20 rounded-full border border-slate-200"
                          name={roomDisplayName}
                          size={80}
                        />
                      </div>
                    </div>

                    {roomProfile.banners.length > 0 ? (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                          Banner
                        </p>
                        <div className="mt-3 grid gap-3">
                          {roomProfile.banners.map((banner, index) =>
                            banner.url ? (
                              <a
                                key={`${banner.imageUrl}-${index}`}
                                href={banner.url}
                                target="_blank"
                                rel="noreferrer"
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-sky-300"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={banner.imageUrl}
                                  alt={`${roomDisplayName} banner ${index + 1}`}
                                  width={640}
                                  height={240}
                                  className="h-auto w-full object-cover"
                                />
                              </a>
                            ) : (
                              <div
                                key={`${banner.imageUrl}-${index}`}
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={banner.imageUrl}
                                  alt={`${roomDisplayName} banner ${index + 1}`}
                                  width={640}
                                  height={240}
                                  className="h-auto w-full object-cover"
                                />
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                        SNS
                      </p>
                      <SocialLinksSection
                        items={roomProfile.snsList}
                        emptyMessage="ルームの SNS は登録されていません。"
                      />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ProfileMetricCard
                        accentClassName="border-emerald-100 bg-emerald-50 text-emerald-700"
                        label="フォロワー"
                        value={formatOptionalMetric(roomProfile.followerNum)}
                      />
                      <ProfileMetricCard
                        accentClassName="border-sky-100 bg-sky-50 text-sky-700"
                        label="ルームレベル"
                        value={formatOptionalMetric(roomProfile.roomLevel)}
                      />
                      <ProfileMetricCard
                        accentClassName="border-violet-100 bg-violet-50 text-violet-700"
                        label="視聴者数"
                        value={formatOptionalMetric(roomProfile.viewNum)}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {roomPrimaryLink ? (
                        <Button asChild>
                          <a href={roomPrimaryLink} target="_blank" rel="noreferrer">
                            ルームページを開く
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : null}
                      {roomProfile.shareUrlLive &&
                        roomProfile.shareUrlLive !== roomPrimaryLink ? (
                        <Button variant="outline" asChild>
                          <a
                            href={roomProfile.shareUrlLive}
                            target="_blank"
                            rel="noreferrer"
                          >
                            ライブ URL
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : null}
                      {roomProfile.shareUrl &&
                        roomProfile.shareUrl !== roomPrimaryLink &&
                        roomProfile.shareUrl !== roomProfile.shareUrlLive ? (
                        <Button variant="outline" asChild>
                          <a href={roomProfile.shareUrl} target="_blank" rel="noreferrer">
                            プロフィール URL
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : null}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-semibold text-slate-950">
                          {roomDisplayName}
                        </h3>
                        {roomProfile.roomId !== null ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            ROOM ID: {roomProfile.roomId}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium",
                            roomProfile.isOnlive
                              ? "bg-rose-100 text-rose-700"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {roomProfile.isOnlive ? "配信中" : "配信外"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          {roomProfile.isOfficial ? "Official" : "Free"}
                        </span>
                        {roomProfile.genreName ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            {roomProfile.genreName}
                          </span>
                        ) : null}
                        {roomProfile.leagueLabel ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            League {roomProfile.leagueLabel}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        {roomProfile.roomUrlKey ? (
                          <div>URL Key: {roomProfile.roomUrlKey}</div>
                        ) : null}
                        {roomProfile.currentLiveStartedAt ? (
                          <div>
                            配信開始: {formatCommentTitle(roomProfile.currentLiveStartedAt)}
                          </div>
                        ) : null}
                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {roomProfile.description || "ルーム説明は未設定です。"}
                      </p>
                    </div>

                    {roomProfile.shareTextLive ? (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                          Share Text
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {roomProfile.shareTextLive}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommentPane({
  blockedUserIds,
  hasLiveInfo,
  initialComments = [],
  initialTelop = null,
  isSnapshot = false,
  isLiveEnded,
  liveComments,
  liveId,
  liveStatus,
  liveTelop,
  onOpenProfile,
  roomId,
}: {
  blockedUserIds: ReadonlySet<string>;
  hasLiveInfo: boolean;
  initialComments?: RoomComment[];
  initialTelop?: string | null;
  isSnapshot?: boolean;
  isLiveEnded: boolean;
  liveComments: readonly CommentRow[];
  liveId: string | null;
  liveStatus: number | null;
  liveTelop: string | null;
  onOpenProfile: OpenProfileHandler;
  roomId: number;
}) {
  const [comments] = useState<CommentRow[]>(() =>
    isSnapshot ? [] : normalizeComments(initialComments)
  );
  const [isLoading] = useState(false);
  const [hasError] = useState(false);
  const showNotice = true;

  useEffect(() => {
    if (
      isSnapshot ||
      !hasLiveInfo ||
      isLiveEnded ||
      liveStatus === 1 ||
      comments.length === 0
    ) {
      return;
    }

    updateOnliveStorageSnapshot(roomId, liveId, (snapshot) => ({
      ...snapshot,
      comments: mergeCommentRows(snapshot.comments, comments),
    }));
  }, [comments, hasLiveInfo, isLiveEnded, isSnapshot, liveId, liveStatus, roomId]);

  const mergedComments = mergeCommentRows(
    liveComments,
    isSnapshot ? [] : comments
  );
  const filteredComments = filterComments(
    filterBlockedShowroomItems(mergedComments, blockedUserIds),
    showNotice
  );
  const isTableLoading = !isSnapshot && isLoading && mergedComments.length === 0;
  const hasTableError = !isSnapshot && hasError && mergedComments.length === 0;
  const telopText = isSnapshot
    ? liveTelop ?? "テロップは保存されていません"
    : liveTelop ?? initialTelop ?? "テロップは設定されていません";

  return (
    <SectionCard
      className="h-full border border-slate-200 pt-1"
      contentClassName="px-0 pb-0"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 px-1 py-0">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3">
            <CardTitle className="shrink-0 text-base">テロップ：</CardTitle>
            <div className="min-w-0 flex-1 text-sm font-medium text-slate-800">
              {telopText}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden border-t border-slate-100">
          <div className="h-full overflow-auto">
            <table className="w-full table-fixed border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">コメント</th>
                </tr>
              </thead>
              <tbody>
                {isTableLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex w-12 shrink-0 flex-col items-center">
                            <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                            <div className="mt-2 h-3 w-10 animate-pulse rounded bg-slate-100" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                            <div className="mt-2 h-3 w-16 animate-pulse rounded bg-slate-100" />
                            <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : hasTableError ? (
                  <tr>
                    <td className="px-4 py-8">
                      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                        Failed to load SHOWROOM comments.
                      </div>
                    </td>
                  </tr>
                ) : filteredComments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                        コメントはまだありません
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredComments.map((comment) => (
                    <tr
                      key={comment.id}
                      className={cn(
                        getCommentRowClassName(comment),
                        comment.notice && comment.userId ? "cursor-pointer" : ""
                      )}
                      onClick={() => {
                        if (comment.notice && comment.userId) {
                          onOpenProfile(comment.userId, comment.name);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          comment.notice &&
                          comment.userId &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          onOpenProfile(comment.userId, comment.name);
                        }
                      }}
                      role={comment.notice && comment.userId ? "button" : undefined}
                      tabIndex={comment.notice && comment.userId ? 0 : undefined}
                      title={comment.titleLabel}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex w-12 shrink-0 flex-col items-center">
                            <ProfileAvatarButton
                              avatarUrl={comment.avatarUrl}
                              name={comment.name}
                              onOpenProfile={onOpenProfile}
                              userId={comment.userId}
                            />
                            <div className="mt-1 text-center text-[10px] leading-4 text-slate-500">
                              {formatClassLevel(comment.classLevel)}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <UserVisitStatusBadge
                                userId={comment.userId}
                                userVisitStatus={comment.userVisitStatus}
                              />
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {comment.name}
                              </div>
                              |
                              <div className="text-xs text-slate-500">
                                {comment.userId ? `ID: ${comment.userId}` : "ID: --"}
                              </div>
                              |
                              <div className="text-xs text-slate-500">
                                {comment.timeLabel}
                              </div>
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">
                              {comment.text}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function GiftLogTable({
  emptyMessage,
  errorMessage,
  hasError,
  title,
  isLoading,
  items,
  onOpenProfile,
}: {
  emptyMessage: string;
  errorMessage: string;
  hasError: boolean;
  title: string;
  isLoading: boolean;
  items: readonly RoomGiftLog[];
  onOpenProfile: OpenProfileHandler;
}) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="px-4 py-3 font-medium">{title}</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100" />
                    <div className="min-w-0 flex-1">
                      <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                      <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                </td>
              </tr>
            ))
          ) : hasError ? (
            <tr>
              <td className="px-4 py-8">
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                  {errorMessage}
                </div>
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td className="px-4 py-8">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  {emptyMessage}
                </div>
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr
                key={item.id}
                className={cn(
                  "border-b border-slate-100 align-top hover:bg-slate-50",
                  item.userId ? "cursor-pointer" : ""
                )}
                onClick={() => {
                  if (item.userId) {
                    onOpenProfile(item.userId, item.userName);
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    item.userId &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    onOpenProfile(item.userId, item.userName);
                  }
                }}
                role={item.userId ? "button" : undefined}
                tabIndex={item.userId ? 0 : undefined}
                title={formatCommentTitle(item.createdAt)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <ProfileAvatarButton
                      avatarUrl={item.avatarUrl}
                      name={item.userName}
                      onOpenProfile={onOpenProfile}
                      userId={item.userId}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <UserVisitStatusBadge
                          userId={item.userId}
                          userVisitStatus={item.userVisitStatus}
                        />
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {item.userName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.userId ? `ID: ${item.userId}` : "ID: --"}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {item.giftImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.giftImageUrl}
                            alt={item.giftName}
                            width={32}
                            height={32}
                            className="h-8 w-8 shrink-0 rounded border border-slate-100 object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 shrink-0 rounded bg-slate-100" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-slate-700">
                            {item.giftName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatGiftMeta(item)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TotalRankingTable({
  hasError,
  isLoading,
  items,
  onOpenProfile,
}: {
  hasError: boolean;
  isLoading: boolean;
  items: readonly RoomTotalRankingUser[];
  onOpenProfile: OpenProfileHandler;
}) {
  return (
    <SectionCard
      className="h-[320px] pt-0 pb-0 sm:h-[340px] xl:h-full"
      contentClassName="px-0 pb-0 pt-0"
    >
      <div className="h-full overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">累計ランキング</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-10 shrink-0 animate-pulse rounded bg-slate-100" />
                      <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                      <div className="min-w-0 flex-1">
                        <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            ) : hasError ? (
              <tr>
                <td className="px-4 py-8">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                    累計ランキングの情報を取得できませんでした。エラーが発生しました。
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-8">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    累計ランキングはまだありません
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-slate-100 align-top hover:bg-slate-50",
                    item.userId ? "cursor-pointer" : ""
                  )}
                  onClick={() => {
                    if (item.userId) {
                      onOpenProfile(item.userId, item.userName);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      item.userId &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onOpenProfile(item.userId, item.userName);
                    }
                  }}
                  role={item.userId ? "button" : undefined}
                  tabIndex={item.userId ? 0 : undefined}
                  title={item.userId ? `User ID: ${item.userId}` : item.userName}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 shrink-0 text-sm font-semibold text-slate-900">
                        {item.rank}位
                      </div>
                      <ProfileAvatarButton
                        avatarUrl={item.avatarUrl}
                        name={item.userName}
                        onOpenProfile={onOpenProfile}
                        userId={item.userId}
                      />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <UserVisitStatusBadge
                            userId={item.userId}
                            userVisitStatus={item.userVisitStatus}
                          />
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {item.userName}
                          </div>
                          {item.userId ? (
                            <div className="shrink-0 text-xs text-slate-500">
                              ID: {item.userId}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatNumber(item.point)} pt
                          {item.visitCount === null
                            ? ""
                            : ` / ${formatNumber(item.visitCount)} 回訪問`}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function LiveRankingTable({
  hasError,
  isLoading,
  items,
  onOpenProfile,
}: {
  hasError: boolean;
  isLoading: boolean;
  items: readonly RoomLiveRankingUser[];
  onOpenProfile: OpenProfileHandler;
}) {
  return (
    <SectionCard
      className="h-[320px] pt-0 pb-0 sm:h-[340px] xl:h-full"
      contentClassName="px-0 pb-0 pt-0"
    >
      <div className="h-full overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">ライブランキング</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-10 shrink-0 animate-pulse rounded bg-slate-100" />
                      <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                    </div>
                  </td>
                </tr>
              ))
            ) : hasError ? (
              <tr>
                <td className="px-4 py-8">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                    ライブランキングの情報を取得できませんでした。エラーが発生しました。
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-8">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    ライブランキングはまだありません
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-slate-100 align-top hover:bg-slate-50",
                    item.userId ? "cursor-pointer" : ""
                  )}
                  onClick={() => {
                    if (item.userId) {
                      onOpenProfile(item.userId, item.userName);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      item.userId &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onOpenProfile(item.userId, item.userName);
                    }
                  }}
                  role={item.userId ? "button" : undefined}
                  tabIndex={item.userId ? 0 : undefined}
                  title={item.userId ? `User ID: ${item.userId}` : item.userName}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 shrink-0 text-sm font-semibold text-slate-900">
                        {item.rank}位
                      </div>
                      <ProfileAvatarButton
                        avatarUrl={item.avatarUrl || item.userImageUrl || null}
                        name={item.userName}
                        onOpenProfile={onOpenProfile}
                        userId={item.userId}
                      />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <UserVisitStatusBadge
                            userId={item.userId}
                            userVisitStatus={item.userVisitStatus}
                          />
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {item.userName}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.userId ? `ID: ${item.userId}` : "Unknown user"}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function LiveBody({
  blockedUserIds,
  gifts,
  hasLiveInfo,
  hasLiveRankingError,
  hasTotalRankingError,
  hasGiftError,
  initialComments = [],
  initialTelop = null,
  isLiveEnded,
  isLiveRankingLoading,
  isTotalRankingLoading,
  isGiftLoading,
  isSnapshot = false,
  liveComments,
  liveId,
  liveRanking,
  liveStatus,
  liveTelop,
  onOpenProfile,
  roomId,
  totalRanking,
}: {
  blockedUserIds: ReadonlySet<string>;
  gifts: readonly RoomGiftLog[];
  hasLiveInfo: boolean;
  hasLiveRankingError: boolean;
  hasTotalRankingError: boolean;
  hasGiftError: boolean;
  initialComments?: RoomComment[];
  initialTelop?: string | null;
  isLiveEnded: boolean;
  isLiveRankingLoading: boolean;
  isTotalRankingLoading: boolean;
  isGiftLoading: boolean;
  isSnapshot?: boolean;
  liveComments: readonly CommentRow[];
  liveId: string | null;
  liveRanking: readonly RoomLiveRankingUser[];
  liveStatus: number | null;
  liveTelop: string | null;
  onOpenProfile: OpenProfileHandler;
  roomId: number;
  totalRanking: readonly RoomTotalRankingUser[];
}) {
  const visibleGifts = filterBlockedShowroomItems(gifts, blockedUserIds);
  const visibleLiveRanking = filterBlockedShowroomItems(
    liveRanking,
    blockedUserIds
  );
  const visibleTotalRanking = filterBlockedShowroomItems(
    totalRanking,
    blockedUserIds
  );
  const freeGifts = visibleGifts.filter(isFreeGiftLog);
  const paidGifts = visibleGifts.filter(isPaidGiftLog);

  return (
    <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="h-svh min-h-0 overflow-hidden md:h-[50vh] xl:h-auto xl:min-h-0">
        <CommentPane
          blockedUserIds={blockedUserIds}
          hasLiveInfo={hasLiveInfo}
          initialComments={initialComments}
          initialTelop={initialTelop}
          isSnapshot={isSnapshot}
          isLiveEnded={isLiveEnded}
          liveComments={liveComments}
          liveId={liveId}
          liveStatus={liveStatus}
          liveTelop={liveTelop}
          onOpenProfile={onOpenProfile}
          roomId={roomId}
        />
      </div>

      <div className="grid min-h-[720px] grid-cols-1 gap-4 sm:grid-cols-2 xl:min-h-0 xl:auto-rows-fr xl:grid-rows-2">
        <SectionCard
          className="h-[320px] py-0 sm:h-[340px] xl:h-full"
          contentClassName="px-0 pb-0 pt-0"
        >
          <GiftLogTable
            items={freeGifts}
            isLoading={isGiftLoading}
            hasError={hasGiftError}
            onOpenProfile={onOpenProfile}
            title="無料ギフト"
            errorMessage="エラーが発生しました。無料ギフトの情報を取得できませんでした。"
            emptyMessage="無料ギフトはまだありません"
          />
        </SectionCard>

        <SectionCard
          className="h-[320px] py-0 sm:h-[340px] xl:h-full"
          contentClassName="px-0 pb-0 pt-0"
        >
          <GiftLogTable
            items={paidGifts}
            isLoading={isGiftLoading}
            hasError={hasGiftError}
            onOpenProfile={onOpenProfile}
            title="有料ギフト"
            errorMessage="エラーが発生しました。有料ギフトの情報を取得できませんでした。"
            emptyMessage="有料ギフトはまだありません"
          />
        </SectionCard>

        <LiveRankingTable
          items={visibleLiveRanking}
          isLoading={isLiveRankingLoading}
          hasError={hasLiveRankingError}
          onOpenProfile={onOpenProfile}
        />
        <TotalRankingTable
          items={visibleTotalRanking}
          isLoading={isTotalRankingLoading}
          hasError={hasTotalRankingError}
          onOpenProfile={onOpenProfile}
        />
      </div>
    </section>
  );
}

function getStoredBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getStoredArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function getStoredRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && !Array.isArray(value) ? value : null;
}

function getStoredTextMetric(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return formatNumber(value);
  }

  return null;
}

function reviveStoredLiveRankingUsers(
  items: readonly unknown[]
): RoomLiveRankingUser[] {
  const rows: RoomLiveRankingUser[] = [];

  for (const item of items) {
    const record = getStoredRecord(item);

    if (!record) {
      continue;
    }

    const rank = getStoredNumber(record.rank);
    const userName = getStoredString(record.userName);

    if (rank === null || !userName) {
      continue;
    }

    const userId = getStoredString(record.userId);

    rows.push({
      id:
        getStoredString(record.id) ??
        `log-live-ranking-${rank}-${userId ?? userName}`,
      avatarId: getStoredNumber(record.avatarId),
      avatarUrl: getStoredString(record.avatarUrl),
      badge: getStoredNumber(record.badge),
      badgeType: getStoredNumber(record.badgeType),
      orderNo: getStoredNumber(record.orderNo),
      rank,
      userId,
      userImageUrl: getStoredString(record.userImageUrl),
      userName,
      userVisitStatus: getStoredNumber(record.userVisitStatus),
    });
  }

  return rows;
}

function reviveStoredTotalRankingUsers(
  items: readonly unknown[]
): RoomTotalRankingUser[] {
  const rows: RoomTotalRankingUser[] = [];

  for (const item of items) {
    const record = getStoredRecord(item);

    if (!record) {
      continue;
    }

    const rank = getStoredNumber(record.rank);
    const point = getStoredNumber(record.point);
    const userName = getStoredString(record.userName);

    if (rank === null || point === null || !userName) {
      continue;
    }

    const userId = getStoredString(record.userId);

    rows.push({
      id:
        getStoredString(record.id) ??
        `log-total-ranking-${rank}-${userId ?? userName}`,
      avatarId: getStoredNumber(record.avatarId),
      avatarUrl: getStoredString(record.avatarUrl),
      order: getStoredNumber(record.order),
      point,
      rank,
      userId,
      userName,
      userVisitStatus: getStoredNumber(record.userVisitStatus),
      visitCount: getStoredNumber(record.visitCount),
    });
  }

  return rows;
}

function reviveLoggedRoomProfile(value: unknown): RoomProfile | null {
  const record = getStoredRecord(value);

  if (!record) {
    return null;
  }

  const roomId = getStoredNumber(record.roomId);
  const roomName = getStoredString(record.roomName);

  if (roomId === null && !roomName) {
    return null;
  }

  return {
    roomId: roomId ?? 0,
    roomUrlKey: getStoredString(record.roomUrlKey) ?? "",
    roomName: roomName ?? "Unknown room",
    roomImageUrl: getStoredString(record.roomImageUrl) ?? "",
    isOnlive: getStoredBoolean(record.isOnlive) ?? false,
    premiumRoomType: getStoredNumber(record.premiumRoomType) ?? 0,
    followerNum: getStoredTextMetric(record.followerNum) ?? "--",
    viewNum: getStoredNumber(record.viewNum),
    genreName: getStoredString(record.genreName) ?? "",
    isOfficial: getStoredBoolean(record.isOfficial) ?? false,
    roomLevel: getStoredTextMetric(record.roomLevel) ?? "--",
    leagueLabel: getStoredString(record.leagueLabel) ?? "",
    showRankSubdivided: getStoredString(record.showRankSubdivided) ?? "",
    showRankTimeCharge: getStoredString(record.showRankTimeCharge),
    nextShowRankSubdivided: getStoredString(record.nextShowRankSubdivided) ?? "",
    currentLiveStartedAt: getStoredNumber(record.currentLiveStartedAt),
  };
}

function getLoggedLiveInfo(log: Record<string, unknown>) {
  const liveInfo = getStoredRecord(log.liveInfo);

  return {
    endedAt: getStoredNumber(liveInfo?.endedAt),
    liveId: getStoredString(liveInfo?.liveId),
    liveStatus: getStoredNumber(liveInfo?.liveStatus),
    startedAt: getStoredNumber(liveInfo?.startedAt),
    telop: getStoredString(liveInfo?.telop),
  };
}

function getLoggedSnapshot(log: Record<string, unknown>) {
  return getStoredRecord(log.localStorageSnapshot);
}

function getLiveEndedAtFromCommentText(text: string): number | null {
  const match =
    /(\d{4})年(\d{1,2})月(\d{1,2})日(\d{1,2})時(\d{1,2})分(\d{1,2})秒に配信が終了しました/.exec(
      text
    );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);

  if (parts.some((part) => !Number.isInteger(part))) {
    return null;
  }

  const [parsedYear, parsedMonth, parsedDay, parsedHour, parsedMinute, parsedSecond] =
    parts;
  const utcMs = Date.UTC(
    parsedYear,
    parsedMonth - 1,
    parsedDay,
    parsedHour - 9,
    parsedMinute,
    parsedSecond
  );

  return Number.isNaN(utcMs) ? null : Math.floor(utcMs / 1000);
}

function getLiveEndedAtFromComments(
  comments: readonly Pick<CommentRow, "text">[]
): number | null {
  for (const comment of comments) {
    if (!comment.text.includes("配信が終了しました")) {
      continue;
    }

    const endedAt = getLiveEndedAtFromCommentText(comment.text);

    if (endedAt !== null) {
      return endedAt;
    }
  }

  return null;
}

export function OnliveLogViewerPage({
  data,
}: {
  data: OnliveLogViewerData;
}) {
  const log = data.log;
  const snapshot = getLoggedSnapshot(log);
  const rankings = getStoredRecord(log.rankings);
  const roomProfile = reviveLoggedRoomProfile(log.roomProfile);
  const liveInfo = getLoggedLiveInfo(log);
  const roomId =
    toLiveNumber(data.roomId) ?? getStoredNumber(log.roomId) ?? 0;
  const liveStartedAt = data.liveStartedAt ?? liveInfo.startedAt;
  const comments = useMemo(
    () =>
      mergeCommentRows(
        reviveStoredCommentRows(getStoredArray(log.comments)),
        reviveStoredCommentRows(getStoredArray(snapshot?.comments))
      ),
    [log.comments, snapshot]
  );
  const liveEndedAt = useMemo(
    () => getLiveEndedAtFromComments(comments),
    [comments]
  );
  const gifts = useMemo(
    () =>
      mergeGiftLogs(
        reviveStoredGiftLogs(getStoredArray(log.gifts)),
        reviveStoredGiftLogs(getStoredArray(snapshot?.gifts))
      ),
    [log.gifts, snapshot]
  );
  const liveRanking = useMemo(
    () => reviveStoredLiveRankingUsers(getStoredArray(rankings?.live)),
    [rankings]
  );
  const totalRanking = useMemo(
    () => reviveStoredTotalRankingUsers(getStoredArray(rankings?.total)),
    [rankings]
  );
  const {
    activeProfile,
    blockedUserIds,
    blockErrorMessage,
    handleBlockUser,
    handleProfileOpenChange,
    isBlockActionPending,
    isBlockListLoading,
    isProfileLoading,
    hasProfileError,
    openProfile,
    profileView,
    selectedProfileTarget,
    setProfileView,
  } = useLiveProfile(roomId);
  const visibleGifts = useMemo(
    () =>
      isBlockListLoading
        ? []
        : filterBlockedShowroomItems(gifts, blockedUserIds),
    [blockedUserIds, gifts, isBlockListLoading]
  );
  const storedMetrics = normalizeStoredMetrics(log.metrics);
  const giftTotalsFromLogs = summarizeGiftTotals(visibleGifts);
  const giftTotals =
    visibleGifts.length > 0 ? giftTotalsFromLogs : storedMetrics.giftTotals;
  const latestFollowerNumText =
    roomProfile?.followerNum ?? storedMetrics.latestFollowerNum;
  const initialFollowerNumText = storedMetrics.initialFollowerNum;
  const latestAudienceNum =
    roomProfile?.viewNum ?? storedMetrics.latestAudienceNum;
  const followerDelta = formatMetricDelta({
    comparisonLabel: "開始から",
    currentValue: parseMetricNumber(latestFollowerNumText),
    hasError: false,
    isLoading: false,
    previousValue: parseMetricNumber(initialFollowerNumText),
    suffix: "人",
  });
  const liveElapsed =
    liveEndedAt === null
      ? formatElapsedTime(null, 0)
      : formatElapsedTime(liveStartedAt, liveEndedAt * 1000);
  const liveIdLabel = liveInfo.liveId ?? data.liveId;
  return (
    <AppShell activeKey="logs" mainClassName="xl:min-h-0 xl:overflow-hidden">
      <section className="shrink-0 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LiveMetricCard
          icon={Gem}
          iconClassName="bg-amber-50 text-amber-700"
          label="獲得ポイント"
          value={formatMetricValue({ hasError: false, isLoading: false, suffix: " pt", value: giftTotals.totalPoints })}
          footer={
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">有料</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatMetricValue({ hasError: false, isLoading: false, suffix: " pt", value: giftTotals.paidPoints })}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">無料</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatMetricValue({ hasError: false, isLoading: false, suffix: " pt", value: giftTotals.freePoints })}
                </p>
              </div>
            </div>
          }
        />
        <LiveMetricCard
          icon={Users}
          iconClassName="bg-sky-50 text-sky-700"
          label="フォロワー数"
          value={<>{latestFollowerNumText ?? "--"} 人</>}
          footer={<MetricDeltaBadge delta={followerDelta} />}
        />
        <LiveMetricCard
          icon={Eye}
          iconClassName="bg-emerald-50 text-emerald-700"
          label="盛り上がり"
          value={formatMetricValue({ hasError: false, isLoading: false, value: latestAudienceNum })}
        />
        <LiveMetricCard
          icon={Timer}
          iconClassName="bg-violet-50 text-violet-700"
          label="配信開始時間"
          value={formatLiveStartedClock(liveStartedAt)}
          valueTitle={formatCommentTitle(liveStartedAt)}
          subValue={<p className="mt-1 text-xs font-medium text-slate-500">{formatLiveStartedDate(liveStartedAt)}</p>}
          footer={
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              <Clock3 className="h-3.5 w-3.5" />
              <span>経過時間 {liveElapsed}</span>
            </div>
          }
        />
      </section>

      <LiveBody
        blockedUserIds={blockedUserIds}
        gifts={visibleGifts}
        hasGiftError={false}
        hasLiveInfo
        hasLiveRankingError={false}
        hasTotalRankingError={false}
        isGiftLoading={isBlockListLoading}
        isLiveEnded
        isLiveRankingLoading={isBlockListLoading}
        isSnapshot
        isTotalRankingLoading={isBlockListLoading}
        liveComments={isBlockListLoading ? [] : comments}
        liveId={liveIdLabel}
        liveRanking={isBlockListLoading ? [] : liveRanking}
        liveStatus={liveInfo.liveStatus ?? 2}
        liveTelop={liveInfo.telop}
        onOpenProfile={openProfile}
        roomId={roomId}
        totalRanking={isBlockListLoading ? [] : totalRanking}
      />
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
    </AppShell>
  );
}

function OnliveRoomPage({ initData }: { initData: OnliveInitOkResponse }) {
  const router = useRouter();
  const { roomId, isPremium } = initData;
  const { gifts, isLoading: isGiftLoading, hasError: hasGiftError } =
    useRoomGiftLogs(initData.gifts);
  const {
    comments: liveComments,
    gifts: liveGifts,
    hasFatalError: hasRealtimeFatalError,
    hasLiveInfo,
    isLiveEnded,
    liveEndedAt,
    liveId,
    liveStatus,
    telop: liveTelop,
  } = useShowroomRealtimeFeed(roomId, initData.liveInfo, initData.giftDefinitions);
  const {
    initialProfile: initialRoomProfile,
    profile: roomProfile,
    previousProfile: previousRoomProfile,
    isLoading: isRoomProfileLoading,
    profileHasError: hasRoomProfileError,
    liveRanking,
    totalRanking,
    liveRankingHasError: hasLiveRankingError,
    totalRankingHasError: hasTotalRankingError,
  } = useOnlivePoll(!isLiveEnded);
  const isLiveRankingLoading = isRoomProfileLoading;
  const isTotalRankingLoading = isRoomProfileLoading;
  const {
    activeProfile,
    blockedUserIds,
    blockErrorMessage,
    handleBlockUser,
    handleProfileOpenChange,
    isBlockActionPending,
    isBlockListLoading,
    isProfileLoading,
    hasProfileError,
    openProfile,
    profileView,
    selectedProfileTarget,
    setProfileView,
  } = useLiveProfile(roomId);
  const [storedMetrics, setStoredMetrics] =
    useState<OnliveStoredMetrics | null>(null);
  const [isLiveEndedDialogOpen, setIsLiveEndedDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const savedOnliveLogKeysRef = useRef(new Set<string>());
  const savingOnliveLogKeysRef = useRef(new Set<string>());
  const mergedGifts = useMemo(
    () => mergeGiftLogs(liveGifts, gifts),
    [gifts, liveGifts]
  );
  const visibleMergedGifts = useMemo(
    () =>
      isBlockListLoading
        ? []
        : filterBlockedShowroomItems(mergedGifts, blockedUserIds),
    [blockedUserIds, isBlockListLoading, mergedGifts]
  );
  const visibleLiveComments = useMemo(
    () =>
      isBlockListLoading
        ? []
        : filterBlockedShowroomItems(liveComments, blockedUserIds),
    [blockedUserIds, isBlockListLoading, liveComments]
  );
  const visibleLiveRanking = useMemo(
    () =>
      isBlockListLoading
        ? []
        : filterBlockedShowroomItems(liveRanking, blockedUserIds),
    [blockedUserIds, isBlockListLoading, liveRanking]
  );
  const hasGiftTotals = visibleMergedGifts.length > 0 || storedMetrics !== null;
  const giftTotalsFromLogs = summarizeGiftTotals(visibleMergedGifts);
  const giftTotals =
    visibleMergedGifts.length > 0 || storedMetrics === null
      ? giftTotalsFromLogs
      : storedMetrics.giftTotals;
  const giftTotalFreePoints = giftTotals.freePoints;
  const giftTotalPaidPoints = giftTotals.paidPoints;
  const giftTotalPoints = giftTotals.totalPoints;
  const liveStartedAt = roomProfile?.currentLiveStartedAt ?? null;
  const liveStartedClock = formatLiveStartedClock(liveStartedAt);
  const liveStartedDate = formatLiveStartedDate(liveStartedAt);
  const liveElapsedNowMs = liveEndedAt === null ? currentTime : liveEndedAt * 1000;
  const liveElapsed = formatElapsedTime(liveStartedAt, liveElapsedNowMs);
  const latestFollowerNumText =
    roomProfile?.followerNum ?? storedMetrics?.latestFollowerNum ?? null;
  const initialFollowerNumText =
    storedMetrics?.initialFollowerNum ??
    initialRoomProfile?.followerNum ??
    null;
  const latestAudienceNum =
    roomProfile?.viewNum ?? storedMetrics?.latestAudienceNum ?? null;
  const previousAudienceNum =
    previousRoomProfile?.viewNum ??
    storedMetrics?.previousAudienceNum ??
    null;
  const currentFollowerNum = parseMetricNumber(latestFollowerNumText);
  const isFollowerMetricLoading =
    isRoomProfileLoading && latestFollowerNumText === null;
  const hasFollowerMetricError =
    hasRoomProfileError && latestFollowerNumText === null;
  const isAudienceMetricLoading =
    isRoomProfileLoading && latestAudienceNum === null;
  const hasAudienceMetricError =
    hasRoomProfileError && latestAudienceNum === null;
  const isGiftMetricLoading = isGiftLoading && !hasGiftTotals;
  const hasGiftMetricError = hasGiftError && !hasGiftTotals;
  const followerDelta = formatMetricDelta({
    comparisonLabel: "配信開始から",
    currentValue: currentFollowerNum,
    hasError: hasFollowerMetricError,
    isLoading:
      isRoomProfileLoading &&
      (latestFollowerNumText === null || initialFollowerNumText === null),
    previousValue: parseMetricNumber(initialFollowerNumText),
    suffix: "人",
  });
  const audienceDelta = formatMetricDelta({
    currentValue: latestAudienceNum,
    hasError: hasAudienceMetricError,
    isLoading: isRoomProfileLoading && latestAudienceNum === null,
    previousValue: previousAudienceNum,
    suffix: "",
  });
  const isUnavailableDialogOpen =
    !hasRealtimeFatalError &&
    !isLiveEnded &&
    !isLiveEndedDialogOpen &&
    (liveStatus === 1 || initialRoomProfile?.isOnlive === false);

  useEffect(() => {
    if (!hasLiveInfo) {
      return;
    }

    let isActive = true;

    if (liveStatus === 1) {
      removeOnliveStorageSnapshot(roomId);

      const timeoutId = window.setTimeout(() => {
        if (isActive) {
          setStoredMetrics(null);
        }
      }, 0);

      return () => {
        isActive = false;
        window.clearTimeout(timeoutId);
      };
    }

    if (isLiveEnded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!isActive) {
        return;
      }

      const storedSnapshot = readOnliveStorageSnapshot(roomId, liveId);
      setStoredMetrics(storedSnapshot?.metrics ?? null);
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [hasLiveInfo, isLiveEnded, liveId, liveStatus, roomId]);

  useEffect(() => {
    if (!liveStartedAt || isLiveEnded) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isLiveEnded, liveStartedAt]);

  useEffect(() => {
    if (!hasLiveInfo || isLiveEnded || liveStatus === 1 || gifts.length === 0) {
      return;
    }

    updateOnliveStorageSnapshot(roomId, liveId, (snapshot) => ({
      ...snapshot,
      gifts: mergeGiftLogs(snapshot.gifts, gifts),
    }));
  }, [gifts, hasLiveInfo, isLiveEnded, liveId, liveStatus, roomId]);

  useEffect(() => {
    if (!hasLiveInfo || isLiveEnded || liveStatus === 1) {
      return;
    }

    const nextMetrics: OnliveStoredMetrics = {
      giftTotals: {
        freePoints: giftTotalFreePoints,
        paidPoints: giftTotalPaidPoints,
        totalPoints: giftTotalPoints,
      },
      initialFollowerNum: initialFollowerNumText,
      latestFollowerNum: latestFollowerNumText,
      latestAudienceNum,
      previousAudienceNum,
    };

    updateOnliveStorageSnapshot(roomId, liveId, (snapshot) => ({
      ...snapshot,
      metrics: {
        giftTotals: hasGiftTotals
          ? nextMetrics.giftTotals
          : snapshot.metrics.giftTotals,
        initialFollowerNum:
          snapshot.metrics.initialFollowerNum ??
          nextMetrics.initialFollowerNum,
        latestFollowerNum:
          nextMetrics.latestFollowerNum ?? snapshot.metrics.latestFollowerNum,
        latestAudienceNum:
          nextMetrics.latestAudienceNum ?? snapshot.metrics.latestAudienceNum,
        previousAudienceNum:
          nextMetrics.previousAudienceNum ??
          snapshot.metrics.previousAudienceNum,
      },
    }));
  }, [
    giftTotalFreePoints,
    giftTotalPaidPoints,
    giftTotalPoints,
    hasGiftTotals,
    hasLiveInfo,
    initialFollowerNumText,
    isLiveEnded,
    latestAudienceNum,
    latestFollowerNumText,
    liveId,
    liveStatus,
    previousAudienceNum,
    roomId,
  ]);

  useEffect(() => {
    if (
      !hasLiveInfo ||
      !isLiveEnded ||
      liveStatus === 1 ||
      !liveId ||
      liveEndedAt === null
    ) {
      return;
    }

    const capturedAt = toJstIsoString(new Date(liveEndedAt * 1000));
    const logKey = `${roomId}:${liveId}:${capturedAt}`;

    if (
      savedOnliveLogKeysRef.current.has(logKey) ||
      savingOnliveLogKeysRef.current.has(logKey)
    ) {
      return;
    }

    let isActive = true;
    savingOnliveLogKeysRef.current.add(logKey);

    async function saveEndedLiveLog() {
      const storageSnapshot = readOnliveStorageSnapshot(roomId, liveId);
      const comments = mergeCommentRows(
        visibleLiveComments,
        filterBlockedShowroomItems(
          storageSnapshot?.comments ?? [],
          blockedUserIds
        )
      );
      const logGifts = mergeGiftLogs(
        visibleMergedGifts,
        filterBlockedShowroomItems(storageSnapshot?.gifts ?? [], blockedUserIds)
      );
      const fallbackMetrics: OnliveStoredMetrics = {
        giftTotals: {
          freePoints: giftTotalFreePoints,
          paidPoints: giftTotalPaidPoints,
          totalPoints: giftTotalPoints,
        },
        initialFollowerNum: initialFollowerNumText,
        latestFollowerNum: latestFollowerNumText,
        latestAudienceNum,
        previousAudienceNum,
      };
      const log: OnliveLogPayload = {
        capturedAt,
        comments,
        gifts: logGifts,
        liveInfo: {
          endedAt: liveEndedAt,
          liveId,
          liveStatus,
          startedAt: liveStartedAt,
          telop: liveTelop,
        },
        localStorageSnapshot: storageSnapshot,
        metrics: storageSnapshot?.metrics ?? storedMetrics ?? fallbackMetrics,
        rankings: {
          live: [...visibleLiveRanking],
        },
        roomProfile: roomProfile ?? initialRoomProfile,
        roomId,
        savedAt: toJstIsoString(),
        source: "onlive-end",
        version: ONLIVE_LOG_VERSION,
      };

      if (!isPremium) {
        const localLog: OnliveLocalLog = {
          capturedAt,
          commentCount: comments.length,
          giftCount: logGifts.length,
          liveId: liveId!,
          liveRankingCount: visibleLiveRanking.length,
          log: log as Record<string, unknown>,
          roomId: String(roomId),
          roomName: (roomProfile ?? initialRoomProfile)?.roomName ?? null,
          savedAt: toJstIsoString(),
        };
        writeOnliveLocalLog(roomId, localLog);
        savedOnliveLogKeysRef.current.add(logKey);
        removeOnliveStorageSnapshot(roomId);
        savingOnliveLogKeysRef.current.delete(logKey);

        if (isActive) {
          setStoredMetrics(null);
          setIsLiveEndedDialogOpen(true);
        }
        return;
      }

      try {
        const response = await fetch("/api/onlive/logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            capturedAt,
            liveId,
            log,
            roomId: String(roomId),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save onlive log");
        }

        savedOnliveLogKeysRef.current.add(logKey);
        removeOnliveStorageSnapshot(roomId);

        if (isActive) {
          setStoredMetrics(null);
          setIsLiveEndedDialogOpen(true);
        }
      } catch (error) {
        console.error(error);
      } finally {
        savingOnliveLogKeysRef.current.delete(logKey);
      }
    }

    void saveEndedLiveLog();

    return () => {
      isActive = false;
    };
  }, [
    giftTotalFreePoints,
    giftTotalPaidPoints,
    giftTotalPoints,
    blockedUserIds,
    hasLiveInfo,
    initialFollowerNumText,
    isPremium,
    isLiveEnded,
    latestAudienceNum,
    latestFollowerNumText,
    liveEndedAt,
    liveId,
    liveStartedAt,
    liveStatus,
    liveTelop,
    previousAudienceNum,
    roomProfile,
    roomId,
    initialRoomProfile,
    storedMetrics,
    visibleLiveComments,
    visibleLiveRanking,
    visibleMergedGifts,
  ]);

  const handleUnavailableConfirm = () => {
    router.replace("/dashboard");
  };

  const handleFatalErrorConfirm = () => {
    window.location.reload();
  };

  const handleLiveEndedConfirm = () => {
    setIsLiveEndedDialogOpen(false);
    router.replace("/dashboard");
  };

  return (
    <AppShell
      activeKey="dashboard"
      headerClassName="h-8"
      mainClassName="xl:min-h-0 xl:overflow-hidden"
      showMenu={false}
    >
      <section className="shrink-0 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LiveMetricCard
          icon={Gem}
          iconClassName="bg-amber-50 text-amber-700"
          label="獲得ポイント"
          value={<>約{formatMetricValue({ hasError: hasGiftMetricError, isLoading: isGiftMetricLoading, suffix: " pt", value: giftTotalPoints })}</>}
          footer={
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">有料</p>
                <p className="mt-1 font-semibold text-slate-900">
                  約{formatMetricValue({ hasError: hasGiftMetricError, isLoading: isGiftMetricLoading, suffix: " pt", value: giftTotalPaidPoints })}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">無料</p>
                <p className="mt-1 font-semibold text-slate-900">
                  約{formatMetricValue({ hasError: hasGiftMetricError, isLoading: isGiftMetricLoading, suffix: " pt", value: giftTotalFreePoints })}
                </p>
              </div>
            </div>
          }
        />
        <LiveMetricCard
          icon={Users}
          iconClassName="bg-sky-50 text-sky-700"
          label="フォロワー数"
          value={<>{formatTextMetricValue({ hasError: hasFollowerMetricError, isLoading: isFollowerMetricLoading, value: latestFollowerNumText })} 人</>}
          footer={<MetricDeltaBadge delta={followerDelta} />}
        />
        <LiveMetricCard
          icon={Eye}
          iconClassName="bg-emerald-50 text-emerald-700"
          label="盛り上がり"
          value={formatMetricValue({ hasError: hasAudienceMetricError, isLoading: isAudienceMetricLoading, value: latestAudienceNum })}
          footer={<MetricDeltaBadge delta={audienceDelta} />}
        />
        <LiveMetricCard
          icon={Timer}
          iconClassName="bg-violet-50 text-violet-700"
          label="配信開始時間"
          value={isRoomProfileLoading ? "..." : liveStartedClock}
          valueTitle={formatCommentTitle(liveStartedAt)}
          subValue={<p className="mt-1 text-xs font-medium text-slate-500">{isRoomProfileLoading ? "読み込み中..." : liveStartedDate}</p>}
          footer={
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              <Clock3 className="h-3.5 w-3.5" />
              <span>経過時間 {isRoomProfileLoading ? "..." : hasRoomProfileError ? "--" : liveElapsed}</span>
            </div>
          }
        />
      </section>

      <LiveBody
        blockedUserIds={blockedUserIds}
        gifts={visibleMergedGifts}
        hasLiveInfo={hasLiveInfo}
        initialComments={initData.comments}
        initialTelop={initData.telop}
        liveRanking={visibleLiveRanking}
        liveComments={visibleLiveComments}
        liveId={liveId}
        liveStatus={liveStatus}
        liveTelop={liveTelop}
        totalRanking={totalRanking}
        onOpenProfile={openProfile}
        roomId={roomId}
        isLiveEnded={isLiveEnded}
        isLiveRankingLoading={isLiveRankingLoading || isBlockListLoading}
        isTotalRankingLoading={isTotalRankingLoading || isBlockListLoading}
        hasLiveRankingError={hasLiveRankingError}
        hasTotalRankingError={hasTotalRankingError}
        isGiftLoading={
          (isGiftLoading || isBlockListLoading) &&
          visibleMergedGifts.length === 0
        }
        hasGiftError={hasGiftError && visibleMergedGifts.length === 0}
      />

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
      <Dialog open={hasRealtimeFatalError}>
        <DialogContent
          className="max-w-sm"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogTitle>エラーが発生しました</DialogTitle>
          <DialogDescription>再読み込みを行います。</DialogDescription>
          <DialogFooter>
            <Button type="button" onClick={handleFatalErrorConfirm}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isUnavailableDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>配信中ではありません</DialogTitle>
          <DialogDescription>
            現在このルームは配信中ではありません。
          </DialogDescription>
          <DialogFooter>
            <Button type="button" onClick={handleUnavailableConfirm}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isLiveEndedDialogOpen && !hasRealtimeFatalError}>
        <DialogContent
          className="max-w-sm"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogTitle>配信は終了しました</DialogTitle>
          <DialogDescription>
            配信は終了しました、ダッシュボードに戻ります
          </DialogDescription>
          <DialogFooter>
            <Button type="button" onClick={handleLiveEndedConfirm}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export function OnlivePage() {
  const router = useRouter();
  const [initData, setInitData] = useState<OnliveInitOkResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadInitData() {
      let data: OnliveInitOkResponse | { status: "no_room" };

      try {
        const response = await fetch("/api/onlive/init", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch init data");
        }

        data = (await response.json()) as OnliveInitOkResponse | { status: "no_room" };
      } catch (error) {
        if ((error as Error).name === "AbortError" || !isActive) {
          return;
        }

        router.replace("/search");
        return;
      }

      if (!isActive) {
        return;
      }

      if (data.status === "no_room") {
        router.replace("/search");
        return;
      }

      setInitData(data);
    }

    const timeoutId = window.setTimeout(() => {
      void loadInitData();
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [router]);

  if (initData === null) {
    return null;
  }

  return <OnliveRoomPage initData={initData} />;
}
