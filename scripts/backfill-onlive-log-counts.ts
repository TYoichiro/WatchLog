/**
 * 1回限りのバックフィルバッチ
 * マイグレーションで追加した comment_count / gift_count が
 * 0 のままになっている既存レコードを log JSON から再計算して更新する。
 *
 * 実行方法:
 *   npx tsx scripts/backfill-onlive-log-counts.ts
 *
 * DATABASE_URL は .env または環境変数から取得する。
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client.js";

const BATCH_SIZE = 200;

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function extractCounts(log: unknown): {
  commentCount: number;
  giftCount: number;
} {
  const record = getRecord(log) ?? {};
  return {
    commentCount: getArrayLength(record.comments),
    giftCount: getArrayLength(record.gifts),
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL が設定されていません。");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  let cursor: string | undefined;
  let totalProcessed = 0;
  let totalUpdated = 0;

  console.log("onlive_log 件数カラムのバックフィルを開始します...\n");

  try {
    while (true) {
      const rows = await prisma.onliveLog.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        select: {
          id: true,
          log: true,
          commentCount: true,
          giftCount: true,
        },
      });

      if (rows.length === 0) break;

      cursor = rows[rows.length - 1].id;

      const toUpdate: Array<{
        id: string;
        commentCount: number;
        giftCount: number;
      }> = [];

      for (const row of rows) {
        const counts = extractCounts(row.log);
        const needsUpdate =
          row.commentCount !== counts.commentCount ||
          row.giftCount !== counts.giftCount;

        if (needsUpdate) {
          toUpdate.push({ id: row.id, ...counts });
        }
      }

      totalProcessed += rows.length;

      if (toUpdate.length > 0) {
        await prisma.$transaction(
          toUpdate.map((item) =>
            prisma.onliveLog.update({
              where: { id: item.id },
              data: {
                commentCount: item.commentCount,
                giftCount: item.giftCount,
              },
            })
          )
        );

        for (const item of toUpdate) {
          console.log(
            `  更新: ${item.id}  comments=${item.commentCount}  gifts=${item.giftCount}`
          );
        }

        totalUpdated += toUpdate.length;
      }

      console.log(
        `  バッチ完了: ${rows.length} 件処理 / うち ${toUpdate.length} 件更新 (累計: ${totalProcessed} 件処理 / ${totalUpdated} 件更新)`
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `\n完了: 合計 ${totalProcessed} 件処理 / ${totalUpdated} 件更新しました。`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
