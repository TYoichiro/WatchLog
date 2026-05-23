import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(unixSeconds: number | null | undefined): string {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) {
    return "未定";
  }

  const date = new Date(unixSeconds * 1000);
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}年${get("month")}月${get("day")}日（${get("weekday")}） ${get("hour")}時${get("minute")}分`;
}
