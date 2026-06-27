import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

import { GET, POST } from "./route";

describe("GET /api/auth/[...nextauth]", () => {
  it("GET ハンドラーがエクスポートされている", () => {
    expect(typeof GET).toBe("function");
  });
});

describe("POST /api/auth/[...nextauth]", () => {
  it("POST ハンドラーがエクスポートされている", () => {
    expect(typeof POST).toBe("function");
  });
});
