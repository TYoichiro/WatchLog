import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppNotice } from "@/lib/dashboard-notices";
import WatchLogLoginPage from "./page";

const {
  authMock,
  getLoginNoticesMock,
  getUserRegisteredRoomMock,
  prismaUserFindUniqueMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getLoginNoticesMock: vi.fn(),
  getUserRegisteredRoomMock: vi.fn(),
  prismaUserFindUniqueMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: prismaUserFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/user-registered-room", () => ({
  getUserRegisteredRoom: getUserRegisteredRoomMock,
}));

vi.mock("@/lib/dashboard-notices", () => ({
  getLoginNotices: getLoginNoticesMock,
}));

vi.mock("@/components/login/login-screen", () => ({
  LoginScreen: ({
    hasNoticesError,
    loginNotices,
  }: {
    hasNoticesError: boolean;
    loginNotices: AppNotice[];
    signInWithGoogle: unknown;
  }) => (
    <div
      data-testid="login-screen"
      data-has-notices-error={String(hasNoticesError)}
    >
      {loginNotices.map((notice) => (
        <div key={notice.id} data-testid="notice">
          {notice.title}
        </div>
      ))}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  authMock.mockReset();
  getLoginNoticesMock.mockReset();
  getUserRegisteredRoomMock.mockReset();
  prismaUserFindUniqueMock.mockReset();
  redirectMock.mockClear();
});

describe("WatchLogLoginPage", () => {
  it("未ログインの場合はログイン画面を表示する", async () => {
    authMock.mockResolvedValue(null);
    getLoginNoticesMock.mockResolvedValue([]);

    render(await WatchLogLoginPage());

    expect(screen.getByTestId("login-screen")).not.toBeNull();
  });

  it("未ログインの場合はログインお知らせを LoginScreen に渡す", async () => {
    const notices: AppNotice[] = [
      {
        id: 1,
        title: "メンテナンス",
        date: "2026/06/27 00:00",
        body: "メンテ中です",
        linkUrl: null,
      },
    ];
    authMock.mockResolvedValue(null);
    getLoginNoticesMock.mockResolvedValue(notices);

    render(await WatchLogLoginPage());

    expect(screen.getByText("メンテナンス")).not.toBeNull();
    expect(
      screen.getByTestId("login-screen").getAttribute("data-has-notices-error"),
    ).toBe("false");
  });

  it("getLoginNotices が失敗した場合は hasNoticesError=true で LoginScreen を表示する", async () => {
    authMock.mockResolvedValue(null);
    getLoginNoticesMock.mockRejectedValue(new Error("fetch error"));

    render(await WatchLogLoginPage());

    expect(
      screen.getByTestId("login-screen").getAttribute("data-has-notices-error"),
    ).toBe("true");
  });

  it("BANされたユーザーは /banned にリダイレクトされる", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaUserFindUniqueMock.mockResolvedValue({ isBanned: true });

    await expect(WatchLogLoginPage()).rejects.toThrow("NEXT_REDIRECT:/banned");
    expect(redirectMock).toHaveBeenCalledWith("/banned");
  });

  it("ルームを登録済みのユーザーは /dashboard にリダイレクトされる", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaUserFindUniqueMock.mockResolvedValue({ isBanned: false });
    getUserRegisteredRoomMock.mockResolvedValue({ roomId: "12345" });

    await expect(WatchLogLoginPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("ルーム未登録のユーザーは /search にリダイレクトされる", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaUserFindUniqueMock.mockResolvedValue({ isBanned: false });
    getUserRegisteredRoomMock.mockResolvedValue(null);

    await expect(WatchLogLoginPage()).rejects.toThrow("NEXT_REDIRECT:/search");
    expect(redirectMock).toHaveBeenCalledWith("/search");
  });

  it("DBにユーザーレコードがない場合はルームなしとして /search にリダイレクトされる", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaUserFindUniqueMock.mockResolvedValue(null);
    getUserRegisteredRoomMock.mockResolvedValue(null);

    await expect(WatchLogLoginPage()).rejects.toThrow("NEXT_REDIRECT:/search");
    expect(redirectMock).toHaveBeenCalledWith("/search");
  });

  it("prisma.user.findUnique を正しい userId で呼び出す", async () => {
    authMock.mockResolvedValue({ user: { id: "user-42" } });
    prismaUserFindUniqueMock.mockResolvedValue({ isBanned: false });
    getUserRegisteredRoomMock.mockResolvedValue(null);

    await expect(WatchLogLoginPage()).rejects.toThrow("NEXT_REDIRECT:/search");

    expect(prismaUserFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-42" },
      select: { isBanned: true },
    });
  });

  it("getUserRegisteredRoom を session.user.id で呼び出す", async () => {
    authMock.mockResolvedValue({ user: { id: "user-42" } });
    prismaUserFindUniqueMock.mockResolvedValue({ isBanned: false });
    getUserRegisteredRoomMock.mockResolvedValue(null);

    await expect(WatchLogLoginPage()).rejects.toThrow("NEXT_REDIRECT:/search");

    expect(getUserRegisteredRoomMock).toHaveBeenCalledWith("user-42");
  });

  it("未ログインの場合は prisma と getUserRegisteredRoom を呼び出さない", async () => {
    authMock.mockResolvedValue(null);
    getLoginNoticesMock.mockResolvedValue([]);

    render(await WatchLogLoginPage());

    expect(prismaUserFindUniqueMock).not.toHaveBeenCalled();
    expect(getUserRegisteredRoomMock).not.toHaveBeenCalled();
  });
});
