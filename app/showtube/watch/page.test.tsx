import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WatchPage from "./page";

const {
  authMock,
  getOnlivesMock,
  getHlsStreamingUrlsMock,
  getRoomCommentLogMock,
  getRoomLiveInfoMock,
  getUserRolesMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getOnlivesMock: vi.fn(),
  getHlsStreamingUrlsMock: vi.fn(),
  getRoomCommentLogMock: vi.fn(),
  getRoomLiveInfoMock: vi.fn(),
  getUserRolesMock: vi.fn(),
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

vi.mock("@/lib/authz", () => ({
  getUserRoles: getUserRolesMock,
}));

vi.mock("@/lib/showroom", () => ({
  getOnlives: getOnlivesMock,
  getHlsStreamingUrls: getHlsStreamingUrlsMock,
  getRoomCommentLog: getRoomCommentLogMock,
  getRoomLiveInfo: getRoomLiveInfoMock,
}));

vi.mock("@/components/showtube/showtube-shell", () => ({
  ShowTubeShell: ({
    children,
    genres,
    selectedGenreId,
  }: {
    children?: ReactNode;
    genres: Array<{ genreId: number; genreName: string }>;
    selectedGenreId: number | null;
  }) => (
    <div
      data-genre-count={String(genres.length)}
      data-selected-genre-id={String(selectedGenreId)}
      data-testid="showtube-shell"
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/showtube/showtube-watch-page", () => ({
  ShowTubeWatchPage: ({
    item,
    roomId,
    streamingUrls,
    initialComments,
    bcsvrKey,
  }: {
    item: unknown;
    roomId: number;
    streamingUrls: unknown[];
    initialComments: unknown[];
    bcsvrKey: string | null;
  }) => (
    <div
      data-has-item={String(item !== null)}
      data-room-id={String(roomId)}
      data-streaming-urls-count={String(streamingUrls.length)}
      data-comments-count={String(initialComments.length)}
      data-bcsvr-key={String(bcsvrKey)}
      data-testid="showtube-watch-page"
    />
  ),
}));

const session = { user: { id: "user-1" } };

const onlivesData = {
  onlives: [
    {
      genreId: 102,
      genreName: "アイドル",
      hasUpcoming: false,
      lives: [{ roomId: 12345 }],
    },
  ],
};

const defaultSearchParams = {
  searchParams: Promise.resolve({ room_id: "12345" }),
};

afterEach(() => {
  cleanup();
  authMock.mockReset();
  getOnlivesMock.mockReset();
  getHlsStreamingUrlsMock.mockReset();
  getRoomCommentLogMock.mockReset();
  getRoomLiveInfoMock.mockReset();
  getUserRolesMock.mockReset();
  redirectMock.mockClear();
});

beforeEach(() => {
  getUserRolesMock.mockResolvedValue({ isAdmin: false, isPremium: false });
  getOnlivesMock.mockResolvedValue(onlivesData);
  getHlsStreamingUrlsMock.mockResolvedValue([]);
  getRoomCommentLogMock.mockResolvedValue([]);
  getRoomLiveInfoMock.mockResolvedValue({ bcsvrKey: null });
});

describe("WatchPage", () => {
  describe("認証・認可", () => {
    it("ログインしていない場合は / にリダイレクトする", async () => {
      authMock.mockResolvedValue(null);

      await expect(WatchPage(defaultSearchParams)).rejects.toThrow("NEXT_REDIRECT:/");

      expect(redirectMock).toHaveBeenCalledWith("/");
    });

    it("管理者でも有料会員でもない場合は /dashboard にリダイレクトする", async () => {
      authMock.mockResolvedValue(session);

      await expect(WatchPage(defaultSearchParams)).rejects.toThrow("NEXT_REDIRECT:/dashboard");

      expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    });

    it("プレミアムユーザーの場合はアクセスできる", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: false, isPremium: true });

      render(await WatchPage(defaultSearchParams));

      expect(screen.getByTestId("showtube-watch-page")).toBeDefined();
    });

    it("管理者の場合はアクセスできる", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

      render(await WatchPage(defaultSearchParams));

      expect(screen.getByTestId("showtube-watch-page")).toBeDefined();
    });
  });

  describe("room_id バリデーション", () => {
    it("room_id パラメータがない場合は /showtube にリダイレクトする", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

      await expect(
        WatchPage({ searchParams: Promise.resolve({}) }),
      ).rejects.toThrow("NEXT_REDIRECT:/showtube");

      expect(redirectMock).toHaveBeenCalledWith("/showtube");
    });

    it("room_id が数値以外の場合は /showtube にリダイレクトする", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

      await expect(
        WatchPage({ searchParams: Promise.resolve({ room_id: "abc" }) }),
      ).rejects.toThrow("NEXT_REDIRECT:/showtube");

      expect(redirectMock).toHaveBeenCalledWith("/showtube");
    });

    it("room_id が 0 の場合は /showtube にリダイレクトする", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

      await expect(
        WatchPage({ searchParams: Promise.resolve({ room_id: "0" }) }),
      ).rejects.toThrow("NEXT_REDIRECT:/showtube");

      expect(redirectMock).toHaveBeenCalledWith("/showtube");
    });
  });

  describe("item 解決", () => {
    it("対象 roomId のルームが onlives にある場合は item を渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-has-item"),
      ).toBe("true");
    });

    it("対象 roomId のルームが onlives にない場合は item=null を渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

      render(
        await WatchPage({ searchParams: Promise.resolve({ room_id: "99999" }) }),
      );

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-has-item"),
      ).toBe("false");
    });

    it("getOnlives が失敗した場合は item=null を渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
      getOnlivesMock.mockRejectedValue(new Error("API error"));

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-has-item"),
      ).toBe("false");
    });
  });

  describe("roomId の引き渡し", () => {
    it("roomId を ShowTubeWatchPage に渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-room-id"),
      ).toBe("12345");
    });
  });

  describe("streamingUrls の引き渡し", () => {
    it("getHlsStreamingUrls の結果を ShowTubeWatchPage に渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
      getHlsStreamingUrlsMock.mockResolvedValue([
        { id: 1, label: "原画", quality: 0, url: "https://example.com/stream.m3u8" },
      ]);

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-streaming-urls-count"),
      ).toBe("1");
    });

    it("getHlsStreamingUrls が失敗した場合は空の streamingUrls を渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
      getHlsStreamingUrlsMock.mockRejectedValue(new Error("API error"));

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-streaming-urls-count"),
      ).toBe("0");
    });
  });

  describe("initialComments の引き渡し", () => {
    it("getRoomCommentLog の結果を ShowTubeWatchPage に渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
      getRoomCommentLogMock.mockResolvedValue([
        {
          id: "c1",
          name: "ユーザーA",
          text: "コメント",
          userId: "123",
          avatarId: null,
          avatarUrl: null,
          classLevel: null,
          createdAt: 1700000000,
        },
      ]);

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-comments-count"),
      ).toBe("1");
    });

    it("getRoomCommentLog が失敗した場合は空のコメントを渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
      getRoomCommentLogMock.mockRejectedValue(new Error("API error"));

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-comments-count"),
      ).toBe("0");
    });
  });

  describe("bcsvrKey の引き渡し", () => {
    it("getRoomLiveInfo の bcsvrKey を ShowTubeWatchPage に渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
      getRoomLiveInfoMock.mockResolvedValue({ bcsvrKey: "test-bcsvr-key" });

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-bcsvr-key"),
      ).toBe("test-bcsvr-key");
    });

    it("getRoomLiveInfo が失敗した場合は bcsvrKey=null を渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
      getRoomLiveInfoMock.mockRejectedValue(new Error("API error"));

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-watch-page").getAttribute("data-bcsvr-key"),
      ).toBe("null");
    });
  });

  describe("ShowTubeShell へのデータ", () => {
    it("onlives のジャンルリストを ShowTubeShell に渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-shell").getAttribute("data-genre-count"),
      ).toBe("1");
    });

    it("getOnlives が失敗した場合はジャンルなしで ShowTubeShell を表示する", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
      getOnlivesMock.mockRejectedValue(new Error("API error"));

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-shell").getAttribute("data-genre-count"),
      ).toBe("0");
    });

    it("ShowTubeShell に selectedGenreId=null を渡す", async () => {
      authMock.mockResolvedValue(session);
      getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

      render(await WatchPage(defaultSearchParams));

      expect(
        screen.getByTestId("showtube-shell").getAttribute("data-selected-genre-id"),
      ).toBe("null");
    });
  });
});
