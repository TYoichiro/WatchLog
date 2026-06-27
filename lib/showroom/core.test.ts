import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchShowroomHtml,
  fetchShowroomJson,
  SHOWROOM_HEADERS,
  toFiniteNumber,
  toLargeImageUrl,
  toUnixSeconds,
} from "./core";

// ---- toFiniteNumber ----

describe("toFiniteNumber", () => {
  it("有限の数値はそのまま返す", () => {
    expect(toFiniteNumber(42)).toBe(42);
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber(-1.5)).toBe(-1.5);
  });

  it("NaN は null を返す", () => {
    expect(toFiniteNumber(NaN)).toBeNull();
  });

  it("Infinity は null を返す", () => {
    expect(toFiniteNumber(Infinity)).toBeNull();
    expect(toFiniteNumber(-Infinity)).toBeNull();
  });

  it("有効な数値文字列は数値に変換する", () => {
    expect(toFiniteNumber("123")).toBe(123);
    expect(toFiniteNumber("3.14")).toBe(3.14);
    expect(toFiniteNumber("-42")).toBe(-42);
  });

  it("空文字列は null を返す", () => {
    expect(toFiniteNumber("")).toBeNull();
  });

  it("数値に変換できない文字列は null を返す", () => {
    expect(toFiniteNumber("abc")).toBeNull();
    expect(toFiniteNumber("12px")).toBeNull();
  });

  it("null は null を返す", () => {
    expect(toFiniteNumber(null)).toBeNull();
  });

  it("undefined は null を返す", () => {
    expect(toFiniteNumber(undefined)).toBeNull();
  });
});

// ---- toUnixSeconds ----

describe("toUnixSeconds", () => {
  it("toFiniteNumber と同じ動作をする", () => {
    expect(toUnixSeconds(1700000000)).toBe(1700000000);
    expect(toUnixSeconds("1700000000")).toBe(1700000000);
    expect(toUnixSeconds(null)).toBeNull();
    expect(toUnixSeconds(NaN)).toBeNull();
  });
});

// ---- toLargeImageUrl ----

describe("toLargeImageUrl", () => {
  it("_s. を _l. に変換する", () => {
    expect(toLargeImageUrl("https://example.com/img_s.jpg")).toBe(
      "https://example.com/img_l.jpg"
    );
  });

  it("_m. を _l. に変換する", () => {
    expect(toLargeImageUrl("https://example.com/img_m.jpg")).toBe(
      "https://example.com/img_l.jpg"
    );
  });

  it("_s. も _m. も含まない URL はそのまま返す", () => {
    const url = "https://example.com/img_l.jpg";
    expect(toLargeImageUrl(url)).toBe(url);
  });

  it("_s. が複数ある場合は最初の 1 つだけ変換する", () => {
    expect(toLargeImageUrl("https://example.com/img_s.jpg?size=_s.png")).toBe(
      "https://example.com/img_l.jpg?size=_s.png"
    );
  });
});

// ---- fetchShowroomJson ----

describe("fetchShowroomJson", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功レスポンスで JSON を返す", async () => {
    const data = { test: "value" };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => data,
    } as Response);

    const url = new URL("https://www.showroom-live.com/api/test");
    const result = await fetchShowroomJson<typeof data>(url);
    expect(result).toEqual(data);
  });

  it("SHOWROOM_HEADERS を含むリクエストを送る", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const url = new URL("https://www.showroom-live.com/api/test");
    await fetchShowroomJson(url);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject(SHOWROOM_HEADERS);
  });

  it("レスポンスが ok でない場合は Error を投げる", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const url = new URL("https://www.showroom-live.com/api/test");
    await expect(fetchShowroomJson(url)).rejects.toThrow(
      "Showroom API request failed: 500"
    );
  });
});

// ---- fetchShowroomHtml ----

describe("fetchShowroomHtml", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功レスポンスで HTML 文字列を返す", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => "<html><body>test</body></html>",
    } as Response);

    const url = new URL("https://www.showroom-live.com/room/search");
    const result = await fetchShowroomHtml(url);
    expect(result).toContain("test");
  });

  it("レスポンスが ok でない場合は Error を投げる", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const url = new URL("https://www.showroom-live.com/room/search");
    await expect(fetchShowroomHtml(url)).rejects.toThrow(
      "Showroom HTML request failed: 404"
    );
  });
});
