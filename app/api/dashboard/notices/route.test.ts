import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/dashboard-notices", () => ({
  getDashboardNotices: vi.fn(),
}));

import { GET } from "./route";
import { auth } from "@/auth";
import { getDashboardNotices } from "@/lib/dashboard-notices";

describe("GET /api/dashboard/notices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("未認証の場合は 401 を返す", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const res = await GET();
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBeDefined();
  });

  it("session が存在するが user がない場合は 401 を返す", async () => {
    vi.mocked(auth).mockResolvedValue({} as never);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("認証済みの場合は notices を返す", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getDashboardNotices).mockResolvedValue([
      {
        id: 1,
        title: "テストお知らせ",
        date: "2024/01/01 10:00",
        body: "テスト本文",
        linkUrl: null,
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as { notices: unknown[] };
    expect(data.notices).toHaveLength(1);
  });

  it("notices が空の場合は空配列を返す", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getDashboardNotices).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as { notices: unknown[] };
    expect(data.notices).toHaveLength(0);
  });

  it("getDashboardNotices がエラーをスローした場合は 500 を返す", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getDashboardNotices).mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
