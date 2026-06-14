import { revalidateTag } from "next/cache";
import { NextRequest } from "next/server";

import { authzErrorResponse, requireUser } from "@/lib/authz";
import { logger } from "@/lib/logger";
import {
  blockedUserIdsCacheTag,
  createUserBlock,
  DeveloperBlockForbiddenError,
  listUserBlocks,
  serializeUserBlock,
} from "@/lib/user-blocks";
import type { BlockRequestBody } from "@/types/api/blocks";

export const dynamic = "force-dynamic";

function getRequiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const blocks = await listUserBlocks(user.id);

    return Response.json({
      blocks: blocks.map(serializeUserBlock),
    });
  } catch (error) {
    const response = authzErrorResponse(error);

    if (response) {
      return response;
    }

    return Response.json({ error: "Failed to list blocks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: BlockRequestBody;

  try {
    body = (await request.json()) as BlockRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const blockedUserId = getRequiredText(body.blockedUserId);
  const blockedUserName = getRequiredText(body.blockedUserName);

  if (!blockedUserId || !blockedUserName) {
    return Response.json(
      { error: "blockedUserId and blockedUserName are required" },
      { status: 400 }
    );
  }

  try {
    const user = await requireUser();

    logger.info("ブロック作成を試みています", { userId: user.id, blockedUserId, blockedUserName });

    const block = await createUserBlock(user.id, {
      blockedUserId,
      blockedUserName,
    });

    logger.info("ブロックを作成しました", { userId: user.id, blockId: block.id, blockedUserId });
    revalidateTag(blockedUserIdsCacheTag(user.id));
    return Response.json({ block: serializeUserBlock(block) });
  } catch (error) {
    const response = authzErrorResponse(error);

    if (response) {
      return response;
    }

    if (error instanceof DeveloperBlockForbiddenError) {
      logger.warn("ブロック拒否: 開発者ユーザーはブロックできません", { blockedUserId });
      return Response.json(
        { error: "開発者はブロックできません" },
        { status: error.status }
      );
    }

    logger.error("ブロックの作成に失敗しました", { blockedUserId, error: String(error) });
    return Response.json({ error: "Failed to create block" }, { status: 500 });
  }
}
