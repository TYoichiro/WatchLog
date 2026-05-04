import { NextRequest } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";

import { auth } from "@/auth";
import { saveOnliveLog } from "@/lib/onlive-log";
import { filterBlockedShowroomItems } from "@/lib/showroom-block-filter";
import {
  parseJstWallTime,
  toJstIsoString,
  toJstWallTimeIsoString,
} from "@/lib/jst";
import { getRoomTotalRanking } from "@/lib/showroom";
import { listBlockedShowroomUserIds } from "@/lib/user-blocks";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";
import type { JsonObject, JsonValue } from "@/types/domain/json";
import type { OnliveLogRequestBody } from "@/types/api/onlive-logs";

export const dynamic = "force-dynamic";

const ONLIVE_LOG_VERSION = 1;

function getRequiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getCapturedAt(value: unknown): Date | null {
  return parseJstWallTime(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): JsonValue | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    const items: JsonValue[] = [];

    for (const item of value) {
      const jsonItem = toJsonValue(item);

      if (jsonItem === null && item !== null) {
        return null;
      }

      items.push(jsonItem);
    }

    return items;
  }

  if (isPlainObject(value)) {
    const jsonObject: JsonObject = {};

    for (const [key, item] of Object.entries(value)) {
      const jsonItem = toJsonValue(item);

      if (jsonItem === null && item !== null) {
        return null;
      }

      jsonObject[key] = jsonItem;
    }

    return jsonObject;
  }

  return null;
}

function toJsonObject(value: unknown): JsonObject | null {
  const jsonValue = toJsonValue(value);

  return isPlainObject(jsonValue) ? jsonValue : null;
}

function mergeServerRankingSnapshot(
  clientLog: JsonObject,
  totalRanking: JsonValue,
  totalRankingFetchedAt: string | null,
  totalRankingFetchError: string | null
): Prisma.InputJsonValue {
  const rankings =
    isPlainObject(clientLog.rankings) && !Array.isArray(clientLog.rankings)
      ? clientLog.rankings
      : {};

  return {
    ...clientLog,
    rankings: {
      ...rankings,
      total: totalRanking,
      totalFetchedAt: totalRankingFetchedAt,
      totalFetchError: totalRankingFetchError,
    },
    server: {
      savedAt: toJstIsoString(),
      version: ONLIVE_LOG_VERSION,
    },
  };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: OnliveLogRequestBody;

  try {
    body = (await request.json()) as OnliveLogRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const roomId = getRequiredText(body.roomId);
  const liveId = getRequiredText(body.liveId);
  const capturedAt = getCapturedAt(body.capturedAt);
  const clientLog = toJsonObject(body.log);

  if (!roomId || !liveId || !capturedAt || !clientLog) {
    return Response.json(
      { error: "roomId, liveId, capturedAt, and log are required" },
      { status: 400 }
    );
  }

  const registeredRoom = await getUserRegisteredRoom(userId);

  if (!registeredRoom || registeredRoom.roomId !== roomId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let totalRanking: JsonValue = [];
  let totalRankingFetchedAt: string | null = null;
  let totalRankingFetchError: string | null = null;

  try {
    const [ranking, blockedUserIds] = await Promise.all([
      getRoomTotalRanking(roomId),
      listBlockedShowroomUserIds(userId),
    ]);
    totalRanking =
      toJsonValue(
        filterBlockedShowroomItems(ranking, new Set(blockedUserIds))
      ) ?? [];
    totalRankingFetchedAt = toJstIsoString();
  } catch {
    totalRankingFetchError = "Failed to fetch total ranking";
  }

  const log = mergeServerRankingSnapshot(
    clientLog,
    totalRanking,
    totalRankingFetchedAt,
    totalRankingFetchError
  );

  try {
    const savedLog = await saveOnliveLog({
      capturedAt,
      liveId,
      log,
      roomId,
    });

    return Response.json({
      log: {
        ...savedLog,
        capturedAt: toJstWallTimeIsoString(savedLog.capturedAt),
        updatedAt: toJstWallTimeIsoString(savedLog.updatedAt),
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
