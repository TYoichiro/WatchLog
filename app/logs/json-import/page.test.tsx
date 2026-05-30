import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import JsonImportPage from "./page";

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/components/logs/json-import-viewer-page", () => ({
  JsonImportViewerPage: () => <div data-testid="json-import-viewer" />,
}));

const session = { user: { id: "user-1" } };

afterEach(() => {
  cleanup();
  authMock.mockReset();
  redirectMock.mockClear();
});

describe("JsonImportPage", () => {
  it("未ログインの場合はログイン画面へ遷移する", async () => {
    authMock.mockResolvedValue(null);

    await expect(JsonImportPage()).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("ログイン済みの場合はJsonImportViewerPageを表示する", async () => {
    authMock.mockResolvedValue(session);

    render(await JsonImportPage());

    expect(screen.getByTestId("json-import-viewer")).toBeDefined();
  });
});
