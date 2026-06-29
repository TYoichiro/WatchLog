import { strToU8, zipSync } from "fflate";

import { authzErrorResponse, ForbiddenError, getUserRoles, requireUser } from "@/lib/authz";
import { toJstWallTimeIsoString } from "@/lib/jst";
import { logger } from "@/lib/logger";
import { getAllOnliveLogsWithData, getUserOnliveLogsWithData } from "@/lib/onlive-log";

export const dynamic = "force-dynamic";

function formatJstDateForFilename(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`;
}

export async function GET() {
  try {
    const user = await requireUser();
    const { isAdmin, isPremium } = await getUserRoles(user.id);

    if (!isAdmin && !isPremium) {
      throw new ForbiddenError();
    }

    const logs = isAdmin
      ? await getAllOnliveLogsWithData()
      : await getUserOnliveLogsWithData(user.id);

    const files: Record<string, Uint8Array> = {};

    for (const log of logs) {
      const jsonViewerLog = {
        capturedAt: toJstWallTimeIsoString(log.capturedAt),
        liveId: log.liveId,
        log: log.log,
        roomId: log.roomId,
      };

      const capturedAtForFilename = formatJstDateForFilename(log.capturedAt);
      const entryFilename = `watchlog-${log.liveId}-${capturedAtForFilename}.json`;
      files[entryFilename] = strToU8(JSON.stringify(jsonViewerLog, null, 2));
    }

    const zipData = zipSync(files);

    const dateStr = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .replace(/\//g, "");
    const filename = `watchlog-bulk-${dateStr}.zip`;

    logger.info("一括ダウンロードを実行しました", {
      userId: user.id,
      isAdmin,
      logCount: logs.length,
    });

    return new Response(zipData, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const response = authzErrorResponse(error);
    if (response) return response;
    logger.error("一括ダウンロードに失敗しました", { error: String(error) });
    return Response.json({ error: "Failed to bulk download" }, { status: 500 });
  }
}
