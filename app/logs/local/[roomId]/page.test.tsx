import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LocalLogPage from "./page";

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

vi.mock("@/components/logs/local-log-viewer-page", () => ({
  LocalLogViewerPage: ({ roomId }: { roomId: string }) => (
    <div data-testid="local-log-viewer" data-room-id={roomId} />
  ),
}));

const session = {
  user: {
    id: "user-1",
  },
};

afterEach(() => {
  cleanup();
  authMock.mockReset();
  redirectMock.mockClear();
});

describe("LocalLogPage", () => {
  it("未ログインの場合はログイン画面へ遷移する", async () => {
    authMock.mockResolvedValue(null);

    await expect(
      LocalLogPage({ params: Promise.resolve({ roomId: "12345" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("ログイン済みの場合はroomIdを渡してLocalLogViewerPageを表示する", async () => {
    authMock.mockResolvedValue(session);

    render(
      await LocalLogPage({ params: Promise.resolve({ roomId: "12345" }) }),
    );

    const viewer = screen.getByTestId("local-log-viewer");
    expect(viewer.getAttribute("data-room-id")).toBe("12345");
  });
});
