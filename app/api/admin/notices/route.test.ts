import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireTopAdminRole: vi.fn(),
  authzErrorResponse: vi.fn(() => null),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dashboardNotice: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { requireTopAdminRole, authzErrorResponse } from "@/lib/authz";

const mockActor = { id: "admin-user-id", email: "admin@test.com" };

const mockNotice = {
  id: 1,
  title: "テストお知らせ",
  content: "テスト本文",
  displayTarget: "AUTHENTICATED" as const,
  publishedAt: new Date("2024-01-01T01:00:00.000Z"),
  expiresAt: null,
  linkUrl: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/admin/notices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/notices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireTopAdminRole).mockResolvedValue(mockActor as never);
  });

  it("returns notices list when admin", async () => {
    vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([
      mockNotice,
    ] as never);

    const response = await GET();
    const data = (await response.json()) as { notices: unknown[] };

    expect(response.status).toBe(200);
    expect(data.notices).toHaveLength(1);
  });

  it("returns empty list when no notices", async () => {
    vi.mocked(prisma.dashboardNotice.findMany).mockResolvedValue([] as never);

    const response = await GET();
    const data = (await response.json()) as { notices: unknown[] };

    expect(response.status).toBe(200);
    expect(data.notices).toHaveLength(0);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireTopAdminRole).mockRejectedValue(new Error("Unauthorized"));
    vi.mocked(authzErrorResponse).mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns 500 when database throws", async () => {
    vi.mocked(prisma.dashboardNotice.findMany).mockRejectedValue(
      new Error("DB error"),
    );

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe("POST /api/admin/notices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireTopAdminRole).mockResolvedValue(mockActor as never);
  });

  const validBody = {
    title: "テストお知らせ",
    content: "テスト本文",
    publishedAt: "2024-01-01T10:00",
  };

  it("returns 400 when title is missing", async () => {
    const res = await POST(
      makePostRequest({ content: "内容", publishedAt: "2024-01-01T10:00" }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("title");
  });

  it("returns 400 when title is empty string", async () => {
    const res = await POST(
      makePostRequest({
        title: "  ",
        content: "内容",
        publishedAt: "2024-01-01T10:00",
      }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("title");
  });

  it("returns 400 when content is empty string", async () => {
    const res = await POST(
      makePostRequest({
        title: "タイトル",
        content: "  ",
        publishedAt: "2024-01-01T10:00",
      }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("content");
  });

  it("returns 400 when content is missing", async () => {
    const res = await POST(
      makePostRequest({ title: "タイトル", publishedAt: "2024-01-01T10:00" }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("content");
  });

  it("returns 400 when publishedAt is missing", async () => {
    const res = await POST(
      makePostRequest({ title: "タイトル", content: "内容" }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("publishedAt");
  });

  it("returns 400 when publishedAt is invalid", async () => {
    const res = await POST(
      makePostRequest({ ...validBody, publishedAt: "not-a-date" }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("publishedAt");
  });

  it("returns 400 when displayTarget is invalid", async () => {
    const res = await POST(
      makePostRequest({ ...validBody, displayTarget: "INVALID" }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("displayTarget");
  });

  it("returns 400 when expiresAt is before publishedAt", async () => {
    const res = await POST(
      makePostRequest({
        ...validBody,
        expiresAt: "2023-12-31T10:00",
      }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("expiresAt");
  });

  it("returns 400 when expiresAt is an invalid date string", async () => {
    const res = await POST(
      makePostRequest({ ...validBody, expiresAt: "not-a-date" }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("expiresAt");
  });

  it("returns 400 when expiresAt equals publishedAt", async () => {
    const res = await POST(
      makePostRequest({
        ...validBody,
        publishedAt: "2024-01-01T10:00",
        expiresAt: "2024-01-01T10:00",
      }),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("expiresAt");
  });

  it("returns 400 when body is invalid JSON structure", async () => {
    const req = new Request("http://localhost/api/admin/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates notice and returns 201 with default displayTarget", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          dashboardNotice: {
            create: vi.fn().mockResolvedValue(mockNotice),
          },
        });
      },
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
    const data = (await res.json()) as { notice: { title: string } };
    expect(data.notice.title).toBe("テストお知らせ");
  });

  it("accepts LOGIN displayTarget", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          dashboardNotice: {
            create: vi
              .fn()
              .mockResolvedValue({ ...mockNotice, displayTarget: "LOGIN" }),
          },
        });
      },
    );

    const res = await POST(
      makePostRequest({ ...validBody, displayTarget: "LOGIN" }),
    );
    expect(res.status).toBe(201);
  });

  it("accepts ALL displayTarget", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          dashboardNotice: {
            create: vi
              .fn()
              .mockResolvedValue({ ...mockNotice, displayTarget: "ALL" }),
          },
        });
      },
    );

    const res = await POST(
      makePostRequest({ ...validBody, displayTarget: "ALL" }),
    );
    expect(res.status).toBe(201);
  });

  it("creates notice with valid expiresAt after publishedAt", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          dashboardNotice: {
            create: vi.fn().mockResolvedValue({
              ...mockNotice,
              expiresAt: new Date("2024-01-02T01:00:00.000Z"),
            }),
          },
        });
      },
    );

    const res = await POST(
      makePostRequest({
        ...validBody,
        publishedAt: "2024-01-01T10:00",
        expiresAt: "2024-01-02T10:00",
      }),
    );
    expect(res.status).toBe(201);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireTopAdminRole).mockRejectedValue(new Error("Unauthorized"));
    vi.mocked(authzErrorResponse).mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 500 when database transaction throws", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB error"));

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("linkUrl が空文字列の場合は null として create に渡す", async () => {
    const createMock = vi.fn().mockResolvedValue(mockNotice);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ dashboardNotice: { create: createMock } }),
    );

    const res = await POST(makePostRequest({ ...validBody, linkUrl: "" }));
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkUrl: null }),
      }),
    );
  });

  it("linkUrl が有効な URL の場合は trim して create に渡す", async () => {
    const createMock = vi.fn().mockResolvedValue({ ...mockNotice, linkUrl: "https://example.com" });
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ dashboardNotice: { create: createMock } }),
    );

    const res = await POST(makePostRequest({ ...validBody, linkUrl: "  https://example.com  " }));
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkUrl: "https://example.com" }),
      }),
    );
  });

  it("expiresAt が null の場合は expiresAt: null で作成できる", async () => {
    const createMock = vi.fn().mockResolvedValue(mockNotice);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ dashboardNotice: { create: createMock } }),
    );

    const res = await POST(makePostRequest({ ...validBody, expiresAt: null }));
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: null }),
      }),
    );
  });

  it("expiresAt が空文字列の場合は expiresAt: null で作成できる", async () => {
    const createMock = vi.fn().mockResolvedValue(mockNotice);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ dashboardNotice: { create: createMock } }),
    );

    const res = await POST(makePostRequest({ ...validBody, expiresAt: "" }));
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: null }),
      }),
    );
  });
});
