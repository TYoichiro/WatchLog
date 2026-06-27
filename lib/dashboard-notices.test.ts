import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dashboardNotice: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/jst", () => ({
  toJstWallTimeDate: vi.fn(() => new Date("2024-06-01T01:00:00.000Z")),
  formatJstWallDateTime: vi.fn(() => "2024/01/01 10:00"),
}));

import { getDashboardNotices, getLoginNotices, getNotices } from "./dashboard-notices";
import { prisma } from "@/lib/prisma";

const makeDbNotice = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: "テストお知らせ",
  content: "テスト本文",
  publishedAt: new Date("2024-01-01T01:00:00.000Z"),
  linkUrl: null,
  ...overrides,
});

describe("getNotices", () => {
  beforeEach(() => {
    vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([] as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("authenticated surface", () => {
    it("AUTHENTICATED と ALL を displayTarget に含めてクエリする", async () => {
      await getNotices("authenticated");
      const call = vi.mocked(prisma.dashboardNotice.findMany).mock.calls[0]![0]!;
      expect((call.where!.displayTarget as { in: string[] }).in).toContain("AUTHENTICATED");
      expect((call.where!.displayTarget as { in: string[] }).in).toContain("ALL");
    });

    it("LOGIN を displayTarget に含めない", async () => {
      await getNotices("authenticated");
      const call = vi.mocked(prisma.dashboardNotice.findMany).mock.calls[0]![0]!;
      expect((call.where!.displayTarget as { in: string[] }).in).not.toContain("LOGIN");
    });
  });

  describe("login surface", () => {
    it("LOGIN と ALL を displayTarget に含めてクエリする", async () => {
      await getNotices("login");
      const call = vi.mocked(prisma.dashboardNotice.findMany).mock.calls[0]![0]!;
      expect((call.where!.displayTarget as { in: string[] }).in).toContain("LOGIN");
      expect((call.where!.displayTarget as { in: string[] }).in).toContain("ALL");
    });

    it("AUTHENTICATED を displayTarget に含めない", async () => {
      await getNotices("login");
      const call = vi.mocked(prisma.dashboardNotice.findMany).mock.calls[0]![0]!;
      expect((call.where!.displayTarget as { in: string[] }).in).not.toContain("AUTHENTICATED");
    });
  });

  describe("クエリ条件", () => {
    it("publishedAt の lte 条件を含む", async () => {
      await getNotices("authenticated");
      const call = vi.mocked(prisma.dashboardNotice.findMany).mock.calls[0]![0]!;
      expect(call.where!.publishedAt).toMatchObject({ lte: expect.any(Date) });
    });

    it("expiresAt が null または未来の日時という OR 条件を含む", async () => {
      await getNotices("authenticated");
      const call = vi.mocked(prisma.dashboardNotice.findMany).mock.calls[0]![0]!;
      expect(call.where!.OR).toEqual(
        expect.arrayContaining([
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ]),
      );
    });
  });

  describe("結果のマッピング", () => {
    it("content を body にマッピングする", async () => {
      vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([
        makeDbNotice(),
      ] as never);
      const results = await getNotices("authenticated");
      expect(results[0].body).toBe("テスト本文");
    });

    it("title をマッピングする", async () => {
      vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([
        makeDbNotice(),
      ] as never);
      const results = await getNotices("authenticated");
      expect(results[0].title).toBe("テストお知らせ");
    });

    it("id をマッピングする", async () => {
      vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([
        makeDbNotice({ id: 42 }),
      ] as never);
      const results = await getNotices("authenticated");
      expect(results[0].id).toBe(42);
    });

    it("notices がない場合は空配列を返す", async () => {
      const results = await getNotices("authenticated");
      expect(results).toHaveLength(0);
    });

    it("複数件の場合はすべてマッピングする", async () => {
      vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([
        makeDbNotice({ id: 1 }),
        makeDbNotice({ id: 2 }),
        makeDbNotice({ id: 3 }),
      ] as never);
      const results = await getNotices("authenticated");
      expect(results).toHaveLength(3);
    });
  });

  describe("linkUrl の正規化", () => {
    async function getLinkUrl(linkUrl: string | null) {
      vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([
        makeDbNotice({ linkUrl }),
      ] as never);
      const results = await getNotices("authenticated");
      return results[0].linkUrl;
    }

    it("https URL をそのまま返す", async () => {
      expect(await getLinkUrl("https://example.com")).toBe("https://example.com/");
    });

    it("http URL をそのまま返す", async () => {
      expect(await getLinkUrl("http://example.com")).toBe("http://example.com/");
    });

    it("URL の前後の空白をトリムする", async () => {
      expect(await getLinkUrl("  https://example.com  ")).toBe("https://example.com/");
    });

    it("パスを持つ https URL をそのまま返す", async () => {
      expect(await getLinkUrl("https://example.com/path/to/page")).toBe(
        "https://example.com/path/to/page",
      );
    });

    it("空文字列の場合は null を返す", async () => {
      expect(await getLinkUrl("")).toBeNull();
    });

    it("空白のみの文字列の場合は null を返す", async () => {
      expect(await getLinkUrl("   ")).toBeNull();
    });

    it("null の場合は null を返す", async () => {
      expect(await getLinkUrl(null)).toBeNull();
    });

    it("非 http/https プロトコル (javascript:) の場合は null を返す", async () => {
      expect(await getLinkUrl("javascript:alert('xss')")).toBeNull();
    });

    it("非 http/https プロトコル (ftp:) の場合は null を返す", async () => {
      expect(await getLinkUrl("ftp://example.com")).toBeNull();
    });

    it("無効な URL の場合は null を返す", async () => {
      expect(await getLinkUrl("not-a-url")).toBeNull();
    });

    it("プロトコルなし相対パスの場合は null を返す", async () => {
      expect(await getLinkUrl("/relative/path")).toBeNull();
    });
  });
});

describe("getDashboardNotices", () => {
  beforeEach(() => {
    vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([] as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("authenticated サーフェスで AUTHENTICATED と ALL をクエリする", async () => {
    await getDashboardNotices();
    const call = vi.mocked(prisma.dashboardNotice.findMany).mock.calls[0]![0]!;
    expect((call.where!.displayTarget as { in: string[] }).in).toContain("AUTHENTICATED");
    expect((call.where!.displayTarget as { in: string[] }).in).toContain("ALL");
    expect((call.where!.displayTarget as { in: string[] }).in).not.toContain("LOGIN");
  });
});

describe("getLoginNotices", () => {
  beforeEach(() => {
    vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([] as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("login サーフェスで LOGIN と ALL をクエリする", async () => {
    await getLoginNotices();
    const call = vi.mocked(prisma.dashboardNotice.findMany).mock.calls[0]![0]!;
    expect((call.where!.displayTarget as { in: string[] }).in).toContain("LOGIN");
    expect((call.where!.displayTarget as { in: string[] }).in).toContain("ALL");
    expect((call.where!.displayTarget as { in: string[] }).in).not.toContain("AUTHENTICATED");
  });
});
