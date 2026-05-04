"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type UserBlockListItem = {
  id: string;
  blockedUserId: string;
  blockedUserName: string;
  createdAt: string;
  updatedAt: string;
};

type BlocksResponse = {
  blocks: UserBlockListItem[];
};

type BlockResponse = {
  block: UserBlockListItem;
};

type ErrorResponse = {
  error?: string;
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ErrorResponse;
    return data.error || "ブロック操作に失敗しました";
  } catch {
    return "ブロック操作に失敗しました";
  }
}

function replaceOrPrependBlock(
  blocks: UserBlockListItem[],
  block: UserBlockListItem
): UserBlockListItem[] {
  const existingIndex = blocks.findIndex(
    (item) => item.blockedUserId === block.blockedUserId
  );

  if (existingIndex === -1) {
    return [block, ...blocks];
  }

  const nextBlocks = [...blocks];
  nextBlocks[existingIndex] = block;
  return nextBlocks;
}

export function useUserBlocks() {
  const [blocks, setBlocks] = useState<UserBlockListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const blockedUserIds = useMemo(
    () => new Set(blocks.map((block) => block.blockedUserId)),
    [blocks]
  );

  const refreshBlocks = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/blocks", {
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = (await response.json()) as BlocksResponse;
    setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBlocks() {
      try {
        await refreshBlocks(controller.signal);
        setHasError(false);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    }

    void loadBlocks();

    return () => controller.abort();
  }, [refreshBlocks]);

  const blockUser = useCallback(
    async (blockedUserId: string, blockedUserName: string) => {
      const response = await fetch("/api/blocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          blockedUserId,
          blockedUserName,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as BlockResponse;
      setBlocks((current) => replaceOrPrependBlock(current, data.block));
      return data.block;
    },
    []
  );

  const deleteBlock = useCallback(async (blockId: string) => {
    const response = await fetch(`/api/blocks/${encodeURIComponent(blockId)}`, {
      method: "DELETE",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    setBlocks((current) => current.filter((block) => block.id !== blockId));
  }, []);

  return {
    blockedUserIds,
    blocks,
    blockUser,
    deleteBlock,
    hasError,
    isLoading,
    refreshBlocks,
  };
}
