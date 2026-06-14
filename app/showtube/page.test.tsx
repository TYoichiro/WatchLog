import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ShowTubePage from "./page";

const {
  authMock,
  getOnlivesMock,
  getUserRolesMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getOnlivesMock: vi.fn(),
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
}));

vi.mock("@/components/showtube/showtube-shell", () => ({
  ShowTubeShell: ({
    children,
    genres,
    selectedGenreId,
  }: {
    children?: ReactNode;
    genres: Array<{ genreId: number; genreName: string }>;
    selectedGenreId?: number | null;
  }) => (
    <div
      data-genre-count={String(genres.length)}
      data-genre-names={genres.map((g) => g.genreName).join(",")}
      data-selected-genre-id={String(selectedGenreId ?? null)}
      data-testid="showtube-shell"
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/showtube/showtube-live-page", () => ({
  ShowTubeLivePage: ({
    hasError,
    items,
  }: {
    hasError: boolean;
    items: unknown[];
  }) => (
    <div
      data-has-error={String(hasError)}
      data-items-count={String(items.length)}
      data-testid="showtube-live-page"
    />
  ),
}));

const session = {
  user: {
    id: "user-1",
  },
};

const onlivesData = {
  onlives: [
    { genreId: 0, genreName: "人気", hasUpcoming: false, lives: [{ roomId: 1 }] },
    { genreId: 102, genreName: "アイドル", hasUpcoming: false, lives: [] },
  ],
};

const defaultProps = {
  searchParams: Promise.resolve({}),
};

afterEach(() => {
  cleanup();
  authMock.mockReset();
  getOnlivesMock.mockReset();
  getUserRolesMock.mockReset();
  redirectMock.mockClear();
});

beforeEach(() => {
  getUserRolesMock.mockResolvedValue({ isAdmin: false, isPremium: false });
  getOnlivesMock.mockResolvedValue(onlivesData);
});

describe("ShowTubePage", () => {
  it("ログインしていない場合は / にリダイレクトする", async () => {
    authMock.mockResolvedValue(null);

    await expect(ShowTubePage(defaultProps)).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(getUserRolesMock).not.toHaveBeenCalled();
  });

  it("管理者でも有料会員でもない場合は /dashboard にリダイレクトする", async () => {
    authMock.mockResolvedValue(session);

    await expect(ShowTubePage(defaultProps)).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("プレミアムユーザーの場合は ShowTubeShell を表示する", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: false, isPremium: true });

    render(await ShowTubePage(defaultProps));

    expect(screen.getByTestId("showtube-shell")).toBeDefined();
  });

  it("管理者の場合は ShowTubeShell を表示する", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    render(await ShowTubePage(defaultProps));

    expect(screen.getByTestId("showtube-shell")).toBeDefined();
  });

  it("getUserRoles を user-1 で呼び出す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    await ShowTubePage(defaultProps);

    expect(getUserRolesMock).toHaveBeenCalledWith("user-1");
  });

  it("onlives のジャンルリストを ShowTubeShell に渡す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    render(await ShowTubePage(defaultProps));

    const shell = screen.getByTestId("showtube-shell");
    expect(shell.getAttribute("data-genre-count")).toBe("2");
    expect(shell.getAttribute("data-genre-names")).toBe("人気,アイドル");
  });

  it("getOnlives が失敗した場合はジャンルなしで ShowTubeShell を表示する", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
    getOnlivesMock.mockRejectedValue(new Error("API error"));

    render(await ShowTubePage(defaultProps));

    expect(screen.getByTestId("showtube-shell").getAttribute("data-genre-count")).toBe("0");
  });

  it("onlives データを ShowTubeLivePage に渡す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    render(await ShowTubePage(defaultProps));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("1");
    expect(livePage.getAttribute("data-has-error")).toBe("false");
    expect(getOnlivesMock).toHaveBeenCalled();
  });

  it("getOnlives が失敗した場合は hasError=true を ShowTubeLivePage に渡す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
    getOnlivesMock.mockRejectedValue(new Error("API error"));

    render(await ShowTubePage(defaultProps));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("0");
    expect(livePage.getAttribute("data-has-error")).toBe("true");
  });

  it("genre パラメータが指定された場合は該当ジャンルのルームのみ渡す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    render(await ShowTubePage({ searchParams: Promise.resolve({ genre: "0" }) }));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("1");
  });

  it("genre パラメータが存在しないジャンルIDの場合はルームなしで渡す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    render(await ShowTubePage({ searchParams: Promise.resolve({ genre: "999" }) }));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("0");
  });

  it("genre パラメータが数値以外の場合は全ジャンルのルームを渡す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    render(await ShowTubePage({ searchParams: Promise.resolve({ genre: "abc" }) }));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("1");
  });

  it("複数ジャンルに同じ roomId がある場合は重複排除して渡す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });
    getOnlivesMock.mockResolvedValue({
      onlives: [
        { genreId: 0, genreName: "人気", hasUpcoming: false, lives: [{ roomId: 1 }] },
        { genreId: 102, genreName: "アイドル", hasUpcoming: false, lives: [{ roomId: 1 }, { roomId: 2 }] },
      ],
    });

    render(await ShowTubePage(defaultProps));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("2");
  });

  it("genre パラメータがある場合は selectedGenreId を ShowTubeShell に渡す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    render(await ShowTubePage({ searchParams: Promise.resolve({ genre: "102" }) }));

    expect(
      screen.getByTestId("showtube-shell").getAttribute("data-selected-genre-id"),
    ).toBe("102");
  });

  it("genre パラメータがない場合は selectedGenreId=null を ShowTubeShell に渡す", async () => {
    authMock.mockResolvedValue(session);
    getUserRolesMock.mockResolvedValue({ isAdmin: true, isPremium: false });

    render(await ShowTubePage(defaultProps));

    expect(
      screen.getByTestId("showtube-shell").getAttribute("data-selected-genre-id"),
    ).toBe("null");
  });
});
