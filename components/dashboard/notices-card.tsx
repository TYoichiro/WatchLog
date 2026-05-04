"use client";

import { useEffect, useState } from "react";

import type { AppNotice } from "@/lib/dashboard-notices";
import {
  NoticeListCard,
  NoticeListLoadingCard,
} from "@/components/notices/notice-list-card";

type NoticesResponse = {
  notices: AppNotice[];
};

export function NoticesCard() {
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadNotices() {
      try {
        const response = await fetch("/api/dashboard/notices", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch notices");
        }

        const data = (await response.json()) as NoticesResponse;
        setNotices(data.notices);
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

    void loadNotices();

    return () => controller.abort();
  }, []);

  if (isLoading) {
    return <NoticeListLoadingCard />;
  }

  return <NoticeListCard notices={notices} hasError={hasError} />;
}
