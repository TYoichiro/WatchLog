import { toJstWallTimeDate } from "@/lib/jst";
import { prisma } from "@/lib/prisma";

export type RoomUserCommentInput = {
  userId: string;
  userName: string;
  commentedAt: Date;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 配信ログJSON内の comments 配列から、集計対象となる実コメント
 * （お知らせ/テロップを除く、userId を持つもの）のみを抽出する。
 */
export function extractRoomUserCommentsFromLog(
  commentsValue: unknown
): RoomUserCommentInput[] {
  if (!Array.isArray(commentsValue)) {
    return [];
  }

  const entries: RoomUserCommentInput[] = [];

  for (const item of commentsValue) {
    if (!isPlainObject(item) || item.notice === true || item.telop === true) {
      continue;
    }

    const userId = typeof item.userId === "string" ? item.userId : null;
    const createdAt =
      typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
        ? item.createdAt
        : null;

    if (!userId || createdAt === null) {
      continue;
    }

    const name =
      typeof item.name === "string" && item.name.trim().length > 0
        ? item.name.trim()
        : "Unknown";

    entries.push({
      userId,
      userName: name,
      commentedAt: toJstWallTimeDate(new Date(createdAt * 1000)),
    });
  }

  return entries;
}

export async function upsertRoomUserLastComments(
  roomId: string,
  comments: RoomUserCommentInput[]
): Promise<void> {
  const latestByUser = new Map<string, RoomUserCommentInput>();

  for (const comment of comments) {
    const existing = latestByUser.get(comment.userId);

    if (!existing || comment.commentedAt > existing.commentedAt) {
      latestByUser.set(comment.userId, comment);
    }
  }

  const entries = [...latestByUser.values()];

  if (entries.length === 0) {
    return;
  }

  const existingRows = await prisma.roomUserLastComment.findMany({
    where: {
      roomId,
      showroomUserId: { in: entries.map((entry) => entry.userId) },
    },
    select: { showroomUserId: true, lastCommentAt: true },
  });
  const existingMap = new Map(
    existingRows.map((row) => [row.showroomUserId, row.lastCommentAt])
  );

  const toWrite = entries.filter((entry) => {
    const existingLastCommentAt = existingMap.get(entry.userId);
    return !existingLastCommentAt || entry.commentedAt > existingLastCommentAt;
  });

  if (toWrite.length === 0) {
    return;
  }

  await prisma.$transaction(
    toWrite.map((entry) =>
      prisma.roomUserLastComment.upsert({
        where: {
          roomId_showroomUserId: {
            roomId,
            showroomUserId: entry.userId,
          },
        },
        update: {
          lastCommentAt: entry.commentedAt,
          showroomUserName: entry.userName,
        },
        create: {
          roomId,
          showroomUserId: entry.userId,
          showroomUserName: entry.userName,
          lastCommentAt: entry.commentedAt,
        },
      })
    )
  );
}

export async function getRoomLastCommentMap(
  roomId: string
): Promise<Map<string, Date>> {
  const rows = await prisma.roomUserLastComment.findMany({
    where: { roomId },
    select: { showroomUserId: true, lastCommentAt: true },
  });

  return new Map(rows.map((row) => [row.showroomUserId, row.lastCommentAt]));
}
