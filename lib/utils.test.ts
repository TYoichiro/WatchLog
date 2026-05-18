import { describe, expect, it } from "vitest";

import { formatTime } from "./utils";

describe("formatTime", () => {
  it("null を渡すと「未定」を返す", () => {
    expect(formatTime(null)).toBe("未定");
  });

  it("undefined を渡すと「未定」を返す", () => {
    expect(formatTime(undefined)).toBe("未定");
  });

  it("0 を渡すと「未定」を返す（falsy）", () => {
    expect(formatTime(0)).toBe("未定");
  });

  it("NaN を渡すと「未定」を返す", () => {
    expect(formatTime(Number.NaN)).toBe("未定");
  });

  it("Infinity を渡すと「未定」を返す", () => {
    expect(formatTime(Infinity)).toBe("未定");
  });

  it("-Infinity を渡すと「未定」を返す", () => {
    expect(formatTime(-Infinity)).toBe("未定");
  });

  it("有効な Unix 秒タイムスタンプを日本語日時文字列にフォーマットする", () => {
    // 2026-05-09 12:00 JST = 2026-05-09 03:00 UTC
    const unixSeconds = Date.UTC(2026, 4, 9, 3, 0) / 1000;
    const result = formatTime(unixSeconds);
    expect(result).toContain("2026年");
    expect(result).toContain("05月");
    expect(result).toContain("09日");
    expect(result).toContain("12時");
    expect(result).toContain("00分");
  });

  it("フォーマット結果に曜日を含む", () => {
    // 2026-05-09 は土曜日 (JST)
    const unixSeconds = Date.UTC(2026, 4, 9, 3, 0) / 1000;
    const result = formatTime(unixSeconds);
    expect(result).toContain("土");
  });

  it("年・月・日・時・分のすべてが含まれている", () => {
    const unixSeconds = Date.UTC(2026, 0, 1, 15, 30) / 1000;
    const result = formatTime(unixSeconds);
    expect(result).toMatch(/\d{4}年\d{2}月\d{2}日/);
    expect(result).toMatch(/\d{2}時\d{2}分/);
  });
});
