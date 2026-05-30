import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireTopAdminRole: vi.fn(),
  authzErrorResponse: vi.fn(() => null),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dashboardNotice: {
      findUnique: vi.fn(),
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

import { DELETE, PATCH } from "./route";
import { requireTopAdminRole, authzErrorResponse } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const mockActor = { id: "admin-user-id", email: "admin@test.com" };

const mockExisting = {
  id: 1,
  publishedAt: new Date("2024-01-01T01:00:00.000Z"),
  expiresAt: null,
};

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

function makePatchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/notices/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/notices/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireTopAdminRole).mockResolvedValue(mockActor as never);
    vi.mocked(prisma.dashboardNotice.findUnique).mockResolvedValue(
      mockExisting as never,
    );
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          dashboardNotice: {
            update: vi.fn().mockResolvedValue(mockNotice),
          },
        });
      },
    );
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireTopAdminRole).mockRejectedValue(new Error("Unauthorized"));
    vi.mocked(authzErrorResponse).mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await PATCH(makePatchRequest({ title: "新タイトル" }), makeParams("1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is not a number", async () => {
    const res = await PATCH(makePatchRequest({ title: "新タイトル" }), makeParams("abc"));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("id");
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost/api/admin/notices/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req, makeParams("1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is empty string", async () => {
    const res = await PATCH(makePatchRequest({ title: "  " }), makeParams("1"));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("title");
  });

  it("returns 400 when content is empty string", async () => {
    const res = await PATCH(makePatchRequest({ content: "  " }), makeParams("1"));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("content");
  });

  it("returns 400 when displayTarget is invalid", async () => {
    const res = await PATCH(
      makePatchRequest({ displayTarget: "INVALID" }),
      makeParams("1"),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("displayTarget");
  });

  it("returns 400 when publishedAt is an invalid date string", async () => {
    const res = await PATCH(
      makePatchRequest({ publishedAt: "not-a-date" }),
      makeParams("1"),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("publishedAt");
  });

  it("returns 400 when expiresAt is an invalid date string", async () => {
    const res = await PATCH(
      makePatchRequest({ expiresAt: "not-a-date" }),
      makeParams("1"),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("expiresAt");
  });

  it("returns 404 when notice does not exist", async () => {
    vi.mocked(prisma.dashboardNotice.findUnique).mockResolvedValue(null);

    const res = await PATCH(makePatchRequest({ title: "新タイトル" }), makeParams("1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when expiresAt is not after effective publishedAt", async () => {
    // mockExisting.publishedAt is 2024-01-01T01:00:00Z (= JST 2024-01-01T10:00)
    // expiresAt in JST 2023-12-31T10:00 is before existing publishedAt
    const res = await PATCH(
      makePatchRequest({ expiresAt: "2023-12-31T10:00" }),
      makeParams("1"),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("expiresAt");
  });

  it("returns 400 when new publishedAt is after new expiresAt", async () => {
    const res = await PATCH(
      makePatchRequest({
        publishedAt: "2024-06-15T10:00",
        expiresAt: "2024-06-10T10:00",
      }),
      makeParams("1"),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("expiresAt");
  });

  it("updates notice and returns 200", async () => {
    const res = await PATCH(makePatchRequest({ title: "新タイトル" }), makeParams("1"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { notice: unknown };
    expect(data.notice).toBeDefined();
  });

  it("clears expiresAt when set to null", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          dashboardNotice: {
            update: vi.fn().mockResolvedValue({ ...mockNotice, expiresAt: null }),
          },
        });
      },
    );

    const res = await PATCH(makePatchRequest({ expiresAt: null }), makeParams("1"));
    expect(res.status).toBe(200);
  });

  it("returns 500 when database throws", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB error"));

    const res = await PATCH(makePatchRequest({ title: "新タイトル" }), makeParams("1"));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/admin/notices/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireTopAdminRole).mockResolvedValue(mockActor as never);
    vi.mocked(prisma.dashboardNotice.findUnique).mockResolvedValue(
      { id: 1 } as never,
    );
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          dashboardNotice: {
            delete: vi.fn().mockResolvedValue({}),
          },
        });
      },
    );
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireTopAdminRole).mockRejectedValue(new Error("Unauthorized"));
    vi.mocked(authzErrorResponse).mockReturnValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await DELETE(
      new Request("http://localhost/api/admin/notices/1"),
      makeParams("1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is not a number", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/admin/notices/abc"),
      makeParams("abc"),
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("id");
  });

  it("returns 404 when notice does not exist", async () => {
    vi.mocked(prisma.dashboardNotice.findUnique).mockResolvedValue(null);

    const res = await DELETE(
      new Request("http://localhost/api/admin/notices/1"),
      makeParams("1"),
    );
    expect(res.status).toBe(404);
  });

  it("deletes notice and returns 200 with the id", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/admin/notices/1"),
      makeParams("1"),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: number };
    expect(data.id).toBe(1);
  });

  it("returns 500 when database throws", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB error"));

    const res = await DELETE(
      new Request("http://localhost/api/admin/notices/1"),
      makeParams("1"),
    );
    expect(res.status).toBe(500);
  });
});
