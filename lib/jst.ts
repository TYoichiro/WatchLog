export const APP_TIME_ZONE = "Asia/Tokyo";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const JST_OFFSET_LABEL = "+09:00";
const JST_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function pad3(value: number): string {
  return String(value).padStart(3, "0");
}

export function toJstIsoString(date = new Date()): string {
  const jstDate = new Date(date.getTime() + JST_OFFSET_MS);

  return formatUtcDatePartsAsJstIsoString(jstDate);
}

export function toJstWallTimeDate(date = new Date()): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

export function toJstWallTimeIsoString(date: Date): string {
  return formatUtcDatePartsAsJstIsoString(date);
}

export function formatJstWallDateTime(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("ja-JP", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

export function parseJstWallTime(value: unknown): Date | null {
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : toJstWallTimeDate(date);
  }

  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  const match = JST_DATE_TIME_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "00", minute = "00", second = "00"] =
    match;
  const millisecond = (match[7] ?? "0").padEnd(3, "0").slice(0, 3);
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(millisecond)
    )
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCHours() !== Number(hour) ||
    date.getUTCMinutes() !== Number(minute) ||
    date.getUTCSeconds() !== Number(second)
  ) {
    return null;
  }

  return date;
}

export function createJstWallTimeDate(value: string): Date {
  const date = parseJstWallTime(value);

  if (!date) {
    throw new Error(`Invalid JST date-time: ${value}`);
  }

  return date;
}

function formatUtcDatePartsAsJstIsoString(date: Date): string {
  return [
    `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
      date.getUTCDate()
    )}`,
    `T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(
      date.getUTCSeconds()
    )}.${pad3(date.getUTCMilliseconds())}${JST_OFFSET_LABEL}`,
  ].join("");
}
