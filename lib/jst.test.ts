import { describe, expect, it } from "vitest";

import {
  createJstWallTimeDate,
  formatJstWallDateTime,
  parseJstWallTime,
  toJstIsoString,
  toJstWallTimeDate,
  toJstWallTimeIsoString,
} from "./jst";

// UTC 2026-01-15 06:00:00.000 → JST 2026-01-15 15:00:00.000 (+09:00)
const UTC_BASE = new Date("2026-01-15T06:00:00.000Z");
const JST_EXPECTED_ISO = "2026-01-15T15:00:00.000+09:00";

describe("toJstIsoString", () => {
  it("UTC 日時を JST ISO 文字列に変換する", () => {
    expect(toJstIsoString(UTC_BASE)).toBe(JST_EXPECTED_ISO);
  });

  it("引数省略時は現在時刻を使用して文字列を返す（+09:00 を含む）", () => {
    const result = toJstIsoString();
    expect(result).toMatch(/\+09:00$/);
  });

  it("UTC 2026-01-01 00:00:00 → JST 2026-01-01 09:00:00", () => {
    const utc = new Date("2026-01-01T00:00:00.000Z");
    expect(toJstIsoString(utc)).toBe("2026-01-01T09:00:00.000+09:00");
  });

  it("UTC 2026-12-31 23:00:00 → JST 翌日 2027-01-01 08:00:00", () => {
    const utc = new Date("2026-12-31T23:00:00.000Z");
    expect(toJstIsoString(utc)).toBe("2027-01-01T08:00:00.000+09:00");
  });
});

describe("toJstWallTimeDate", () => {
  it("UTC 日時に +9h した Date を返す", () => {
    const result = toJstWallTimeDate(UTC_BASE);
    expect(result.toISOString()).toBe("2026-01-15T15:00:00.000Z");
  });

  it("引数省略時は現在時刻 +9h の Date を返す", () => {
    const before = Date.now() + 9 * 60 * 60 * 1000;
    const result = toJstWallTimeDate();
    const after = Date.now() + 9 * 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("toJstWallTimeIsoString", () => {
  it("UTC Date の UTC 部分を JST ISO 文字列としてフォーマットする", () => {
    // toJstWallTimeDate で +9h 済みの Date を渡す想定
    const jstWallTime = new Date("2026-01-15T15:00:00.000Z");
    expect(toJstWallTimeIsoString(jstWallTime)).toBe(JST_EXPECTED_ISO);
  });
});

describe("formatJstWallDateTime", () => {
  it("UTC=0 として Intl.DateTimeFormat でフォーマットする（year/month/day）", () => {
    // toJstWallTimeDate で +9h 済みの Date を渡す
    const jstWallTime = new Date("2026-01-15T15:00:00.000Z");
    const result = formatJstWallDateTime(jstWallTime, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    expect(result).toContain("2026");
    expect(result).toContain("01");
    expect(result).toContain("15");
  });

  it("時・分のフォーマット", () => {
    const jstWallTime = new Date("2026-06-15T14:30:00.000Z");
    const result = formatJstWallDateTime(jstWallTime, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(result).toContain("14");
    expect(result).toContain("30");
  });
});

describe("parseJstWallTime", () => {
  describe("文字列入力", () => {
    it("YYYY-MM-DD 形式を JST 壁時刻として解析する", () => {
      // "2026-01-15" は JST の 2026-01-15 00:00:00 = UTC 2026-01-14 15:00:00
      const result = parseJstWallTime("2026-01-15");
      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    });

    it("YYYY-MM-DD HH:mm 形式を解析する", () => {
      const result = parseJstWallTime("2026-06-01 09:30");
      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe("2026-06-01T09:30:00.000Z");
    });

    it("YYYY-MM-DDTHH:mm:ss 形式を解析する", () => {
      const result = parseJstWallTime("2026-06-01T12:00:00");
      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe("2026-06-01T12:00:00.000Z");
    });

    it("ミリ秒付きを解析する", () => {
      const result = parseJstWallTime("2026-06-01T12:00:00.123");
      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe("2026-06-01T12:00:00.123Z");
    });

    it("前後の空白をトリムして解析する", () => {
      const result = parseJstWallTime("  2026-01-15  ");
      expect(result).not.toBeNull();
    });

    it("不正な日付文字列は null を返す", () => {
      expect(parseJstWallTime("not-a-date")).toBeNull();
    });

    it("空文字列は null を返す", () => {
      expect(parseJstWallTime("")).toBeNull();
    });

    it("存在しない日付（2月30日）は null を返す", () => {
      expect(parseJstWallTime("2026-02-30")).toBeNull();
    });

    it("存在しない時刻（25時）は null を返す", () => {
      expect(parseJstWallTime("2026-01-15T25:00:00")).toBeNull();
    });
  });

  describe("数値入力", () => {
    it("Unix ミリ秒タイムスタンプを Date に変換して +9h する", () => {
      // 0ms (UTC 1970-01-01 00:00:00) → JST 壁時刻 = UTC +9h
      const result = parseJstWallTime(0);
      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe("1970-01-01T09:00:00.000Z");
    });

    it("NaN は null を返す", () => {
      expect(parseJstWallTime(NaN)).toBeNull();
    });
  });

  describe("非対応型", () => {
    it("null は null を返す", () => {
      expect(parseJstWallTime(null)).toBeNull();
    });

    it("undefined は null を返す", () => {
      expect(parseJstWallTime(undefined)).toBeNull();
    });

    it("オブジェクトは null を返す", () => {
      expect(parseJstWallTime({})).toBeNull();
    });

    it("配列は null を返す", () => {
      expect(parseJstWallTime([])).toBeNull();
    });
  });
});

describe("createJstWallTimeDate", () => {
  it("有効な日付文字列は Date を返す", () => {
    const result = createJstWallTimeDate("2026-01-15");
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("不正な文字列は Error を投げる", () => {
    expect(() => createJstWallTimeDate("invalid")).toThrow(
      "Invalid JST date-time: invalid"
    );
  });

  it("存在しない日付は Error を投げる", () => {
    expect(() => createJstWallTimeDate("2026-02-30")).toThrow();
  });
});
