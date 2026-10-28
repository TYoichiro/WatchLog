/**
 * 1回限りのバックフィルバッチ
 * 既存の OnliveLog.log 内のコメント履歴から、ルーム×SHOWROOMユーザーごとの
 * 最終コメント日時を room_user_last_comments テーブルへ初期投入する。
 *
 * 実行方法:
 *   npx tsx scripts/backfill-room-user-last-comments.ts
 *
 * DATABASE_URL は .env または環境変数から取得する。
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client.js";

const BATCH_SIZE = 200;
const UPSERT_CHUNK_SIZE = 200;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// lib/jst.ts の toJstWallTimeDate と同じ変換。DB の DateTime カラムは
// 「UTC取得値=JST時刻の見た目」で格納する規約のため、実UNIX時刻に9時間を
// 加算してから Date を作る（そのまま保存すると toJstWallTimeIsoString で
// 表示した際に9時間ずれる）。
function toJstWallTimeDate(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

type AggregatedEntry = {
  roomId: string;
  showroomUserId: string;
  showroomUserName: string;
  lastCommentAt: Date;
};

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractLastCommentEntries(
  roomId: string,
  log: unknown
): { showroomUserId: string; showroomUserName: string; lastCommentAt: Date }[] {
  const record = getRecord(log);
  const comments = Array.isArray(record?.comments) ? record.comments : [];
  const entries: { showroomUserId: string; showroomUserName: string; lastCommentAt: Date }[] = [];

  for (const item of comments) {
    const commentRecord = getRecord(item);
    if (!commentRecord || commentRecord.notice === true || commentRecord.telop === true) {
      continue;
    }

    const showroomUserId =
      typeof commentRecord.userId === "string" ? commentRecord.userId : null;
    const createdAt =
      typeof commentRecord.createdAt === "number" && Number.isFinite(commentRecord.createdAt)
        ? commentRecord.createdAt
        : null;

    if (!showroomUserId || createdAt === null) {
      continue;
    }

    const showroomUserName =
      typeof commentRecord.name === "string" && commentRecord.name.trim().length > 0
        ? commentRecord.name.trim()
        : "Unknown";

    entries.push({
      showroomUserId,
      showroomUserName,
      lastCommentAt: toJstWallTimeDate(new Date(createdAt * 1000)),
    });
  }

  return entries;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL が設定されていません。");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  const aggregated = new Map<string, AggregatedEntry>();

  console.log("room_user_last_comments のバックフィルを開始します...\n");

  try {
    let cursor: string | undefined;
    let totalProcessed = 0;

    while (true) {
      const rows = await prisma.onliveLog.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        select: {
          id: true,
          roomId: true,
          log: true,
        },
      });

      if (rows.length === 0) break;

      cursor = rows[rows.length - 1].id;
      totalProcessed += rows.length;

      for (const row of rows) {
        const entries = extractLastCommentEntries(row.roomId, row.log);

        for (const entry of entries) {
          const key = `${row.roomId}:${entry.showroomUserId}`;
          const existing = aggregated.get(key);

          if (!existing || entry.lastCommentAt > existing.lastCommentAt) {
            aggregated.set(key, {
              roomId: row.roomId,
              showroomUserId: entry.showroomUserId,
              showroomUserName: entry.showroomUserName,
              lastCommentAt: entry.lastCommentAt,
            });
          }
        }
      }

      console.log(`  走査完了: ${rows.length} 件処理 (累計: ${totalProcessed} 件処理 / 集計ユーザー数: ${aggregated.size})`);
    }

    console.log(`\n走査完了。集計対象の (ルーム, ユーザー) 組み合わせ: ${aggregated.size} 件。投入を開始します...\n`);

    const entries = [...aggregated.values()];
    let totalWritten = 0;

    for (let i = 0; i < entries.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = entries.slice(i, i + UPSERT_CHUNK_SIZE);

      await prisma.$transaction(
        chunk.map((entry) =>
          prisma.roomUserLastComment.upsert({
            where: {
              roomId_showroomUserId: {
                roomId: entry.roomId,
                showroomUserId: entry.showroomUserId,
              },
            },
            update: {
              lastCommentAt: entry.lastCommentAt,
              showroomUserName: entry.showroomUserName,
            },
            create: {
              roomId: entry.roomId,
              showroomUserId: entry.showroomUserId,
              showroomUserName: entry.showroomUserName,
              lastCommentAt: entry.lastCommentAt,
            },
          })
        )
      );

      totalWritten += chunk.length;
      console.log(`  投入完了: ${totalWritten} / ${entries.length} 件`);
    }

    console.log(`\n完了: 合計 ${totalWritten} 件のレコードを投入しました。`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
