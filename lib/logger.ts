import fs from "node:fs";
import path from "node:path";

import { toJstIsoString } from "@/lib/jst";

type Level = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const LEVEL_WEIGHTS: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLevel(): Level {
  const env = process.env.LOG_LEVEL;
  if (env === "debug" || env === "info" || env === "warn" || env === "error") {
    return env;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const MIN_LEVEL = resolveMinLevel();

const LOG_DIR = path.join(process.cwd(), "logs");

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {
  // ignore — directory may already exist or be read-only
}

function getJstDateString(): string {
  return toJstIsoString().slice(0, 10);
}

function appendToFile(line: string): void {
  if (process.env.VERCEL || process.env.LOG_FLG === "skip") return;
  const filename = path.join(LOG_DIR, `${getJstDateString()}.log`);
  fs.appendFile(filename, line + "\n", "utf-8", () => {
    // best-effort — ignore write errors to avoid crashing the app
  });
}

function emit(level: Level, message: string, context?: LogContext): void {
  if (LEVEL_WEIGHTS[level] < LEVEL_WEIGHTS[MIN_LEVEL]) {
    return;
  }

  const timestamp = toJstIsoString();
  const entry = { time: timestamp, level, msg: message, ...context };
  const jsonLine = JSON.stringify(entry);

  // File output — always JSON, one line per entry
  appendToFile(jsonLine);

  // Console output
  if (process.env.NODE_ENV === "production") {
    if (level === "error") {
      console.error(jsonLine);
    } else if (level === "warn") {
      console.warn(jsonLine);
    } else {
      console.log(jsonLine);
    }
  } else {
    const tag = `[${level.toUpperCase().padEnd(5)}]`;
    const contextStr =
      context && Object.keys(context).length > 0 ? ` | ${JSON.stringify(context)}` : "";
    const line = `${timestamp} ${tag} ${message}${contextStr}`;
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
