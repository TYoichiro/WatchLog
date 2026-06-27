import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/jst", () => ({
  toJstIsoString: (d: Date) => d.toISOString().replace("Z", "+09:00"),
}));

import {
  deleteOnliveLocalLog,
  getOnliveLocalLogKey,
  isRescueSnapshot,
  isValidJsonViewerLog,
  readJsonViewerLog,
  readOnliveLocalLog,
  rescueSnapshotToJsonViewerLog,
  writeJsonViewerLog,
  writeOnliveLocalLog,
} from "./onlive-local-log";

// ---- getOnliveLocalLogKey ----

describe("getOnliveLocalLogKey", () => {
  it("roomId を含むキーを返す（文字列）", () => {
    const key = getOnliveLocalLogKey("12345");
    expect(key).toContain("12345");
    expect(key).toMatch(/watchlog/);
  });

  it("roomId を含むキーを返す（数値）", () => {
    const key = getOnliveLocalLogKey(99999);
    expect(key).toContain("99999");
  });
});

// ---- localStorage を使う関数 ----

describe("localStorage 操作", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("readOnliveLocalLog", () => {
    it("保存済みログを返す", () => {
      const log = {
        capturedAt: "2026-01-01T12:00:00+09:00",
        commentCount: 3,
        giftCount: 1,
        liveId: "live-1",
        log: {},
        roomId: "12345",
        roomName: "テスト",
        savedAt: "2026-01-01T12:00:00+09:00",
      };
      store[getOnliveLocalLogKey("12345")] = JSON.stringify(log);
      const result = readOnliveLocalLog("12345");
      expect(result).not.toBeNull();
      expect(result!.liveId).toBe("live-1");
    });

    it("データがない場合は null を返す", () => {
      expect(readOnliveLocalLog("12345")).toBeNull();
    });

    it("JSON が壊れている場合は null を返す", () => {
      store[getOnliveLocalLogKey("12345")] = "invalid json{";
      expect(readOnliveLocalLog("12345")).toBeNull();
    });
  });

  describe("writeOnliveLocalLog", () => {
    it("ログを localStorage に保存する", () => {
      const log = {
        capturedAt: "2026-01-01T12:00:00+09:00",
        commentCount: 0,
        giftCount: 0,
        liveId: "live-1",
        log: {},
        roomId: "12345",
        roomName: null,
        savedAt: "2026-01-01T12:00:00+09:00",
      };
      writeOnliveLocalLog("12345", log);
      expect(store[getOnliveLocalLogKey("12345")]).toBeDefined();
    });
  });

  describe("deleteOnliveLocalLog", () => {
    it("localStorage からログを削除する", () => {
      const key = getOnliveLocalLogKey("12345");
      store[key] = "{}";
      deleteOnliveLocalLog("12345");
      expect(store[key]).toBeUndefined();
    });
  });

  describe("readJsonViewerLog", () => {
    it("保存済みの JSON ビューアーログを返す", () => {
      const log = {
        capturedAt: "2026-01-01",
        liveId: "live-1",
        log: {},
        roomId: "12345",
      };
      store["watchlog:json-viewer"] = JSON.stringify(log);
      const result = readJsonViewerLog();
      expect(result).not.toBeNull();
      expect(result!.liveId).toBe("live-1");
    });

    it("データがない場合は null を返す", () => {
      expect(readJsonViewerLog()).toBeNull();
    });
  });

  describe("writeJsonViewerLog", () => {
    it("JSON ビューアーログを localStorage に保存する", () => {
      const log = {
        capturedAt: "2026-01-01",
        liveId: "live-1",
        log: {},
        roomId: "12345",
      };
      writeJsonViewerLog(log);
      expect(store["watchlog:json-viewer"]).toBeDefined();
    });
  });
});

// ---- window が undefined の場合 ----

describe("SSR 環境 (window === undefined)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("readOnliveLocalLog は null を返す", () => {
    expect(readOnliveLocalLog("12345")).toBeNull();
  });

  it("writeOnliveLocalLog は何もしない", () => {
    expect(() =>
      writeOnliveLocalLog("12345", {
        capturedAt: "t",
        commentCount: 0,
        giftCount: 0,
        liveId: "l",
        log: {},
        roomId: "r",
        roomName: null,
        savedAt: "s",
      })
    ).not.toThrow();
  });

  it("deleteOnliveLocalLog は何もしない", () => {
    expect(() => deleteOnliveLocalLog("12345")).not.toThrow();
  });

  it("readJsonViewerLog は null を返す", () => {
    expect(readJsonViewerLog()).toBeNull();
  });
});

// ---- isValidJsonViewerLog ----

describe("isValidJsonViewerLog", () => {
  it("有効なオブジェクトは true を返す", () => {
    expect(
      isValidJsonViewerLog({
        capturedAt: "2026-01-01",
        liveId: "live-1",
        roomId: "12345",
        log: {},
      })
    ).toBe(true);
  });

  it("capturedAt が文字列でない場合は false を返す", () => {
    expect(
      isValidJsonViewerLog({
        capturedAt: 123,
        liveId: "live-1",
        roomId: "12345",
        log: {},
      })
    ).toBe(false);
  });

  it("log が null の場合は false を返す", () => {
    expect(
      isValidJsonViewerLog({
        capturedAt: "t",
        liveId: "l",
        roomId: "r",
        log: null,
      })
    ).toBe(false);
  });

  it("null は false を返す", () => {
    expect(isValidJsonViewerLog(null)).toBe(false);
  });

  it("文字列は false を返す", () => {
    expect(isValidJsonViewerLog("string")).toBe(false);
  });
});

// ---- isRescueSnapshot ----

describe("isRescueSnapshot", () => {
  const valid = {
    version: 1,
    roomId: 12345,
    liveId: "live-1",
    savedAt: 1700000000000,
    comments: [],
    gifts: [],
    metrics: null,
  };

  it("有効なスナップショットは true を返す", () => {
    expect(isRescueSnapshot(valid)).toBe(true);
  });

  it("version が 1 でない場合は false を返す", () => {
    expect(isRescueSnapshot({ ...valid, version: 2 })).toBe(false);
  });

  it("roomId が数値でない場合は false を返す", () => {
    expect(isRescueSnapshot({ ...valid, roomId: "12345" })).toBe(false);
  });

  it("liveId が空文字の場合は false を返す", () => {
    expect(isRescueSnapshot({ ...valid, liveId: "  " })).toBe(false);
  });

  it("comments が配列でない場合は false を返す", () => {
    expect(isRescueSnapshot({ ...valid, comments: "invalid" })).toBe(false);
  });

  it("null は false を返す", () => {
    expect(isRescueSnapshot(null)).toBe(false);
  });
});

// ---- rescueSnapshotToJsonViewerLog ----

describe("rescueSnapshotToJsonViewerLog", () => {
  const snapshot = {
    version: 1 as const,
    roomId: 12345,
    liveId: "live-1",
    savedAt: new Date("2026-01-01T03:00:00.000Z").getTime(),
    comments: ["c1", "c2"],
    gifts: ["g1"],
    metrics: { viewers: 100 },
  };

  it("JsonViewerLog に変換する", () => {
    const result = rescueSnapshotToJsonViewerLog(snapshot);
    expect(result.liveId).toBe("live-1");
    expect(result.roomId).toBe("12345");
    expect(result.log.comments).toEqual(["c1", "c2"]);
    expect(result.log.gifts).toEqual(["g1"]);
    expect(result.log.metrics).toEqual({ viewers: 100 });
  });

  it("log.source が 'rescue' になる", () => {
    const result = rescueSnapshotToJsonViewerLog(snapshot);
    expect(result.log.source).toBe("rescue");
  });

  it("log.version が 1 になる", () => {
    const result = rescueSnapshotToJsonViewerLog(snapshot);
    expect(result.log.version).toBe(1);
  });

  it("log.roomId が roomId 数値になる", () => {
    const result = rescueSnapshotToJsonViewerLog(snapshot);
    expect(result.log.roomId).toBe(12345);
  });
});
