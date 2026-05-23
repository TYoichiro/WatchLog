import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ShowTubePage from "./page";

const {
  authMock,
  getOnlivesMock,
  hasTopAdminRoleMock,
  hasPremiumRoleMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getOnlivesMock: vi.fn(),
  hasTopAdminRoleMock: vi.fn(),
  hasPremiumRoleMock: vi.fn(),
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
  hasTopAdminRole: hasTopAdminRoleMock,
  hasPremiumRole: hasPremiumRoleMock,
}));

vi.mock("@/lib/showroom", () => ({
  getOnlives: getOnlivesMock,
}));

vi.mock("@/components/showtube/showtube-shell", () => ({
  ShowTubeShell: ({
    children,
    genres,
  }: {
    children?: ReactNode;
    genres: Array<{ genreId: number; genreName: string }>;
    selectedGenreId?: number | null;
  }) => (
    <div
      data-genre-count={String(genres.length)}
      data-genre-names={genres.map((g) => g.genreName).join(",")}
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
  hasTopAdminRoleMock.mockReset();
  hasPremiumRoleMock.mockReset();
  redirectMock.mockClear();
});

beforeEach(() => {
  hasTopAdminRoleMock.mockResolvedValue(false);
  hasPremiumRoleMock.mockResolvedValue(false);
  getOnlivesMock.mockResolvedValue(onlivesData);
});

describe("ShowTubePage", () => {
  it("ログインしていない場合は / にリダイレクトする", async () => {
    authMock.mockResolvedValue(null);

    await expect(ShowTubePage(defaultProps)).rejects.toThrow("NEXT_REDIRECT:/");

    expect(redirectMock).toHaveBeenCalledWith("/");
    expect(hasTopAdminRoleMock).not.toHaveBeenCalled();
    expect(hasPremiumRoleMock).not.toHaveBeenCalled();
  });

  it("管理者でも有料会員でもない場合は /dashboard にリダイレクトする", async () => {
    authMock.mockResolvedValue(session);

    await expect(ShowTubePage(defaultProps)).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("プレミアムユーザーの場合は ShowTubeShell を表示する", async () => {
    authMock.mockResolvedValue(session);
    hasPremiumRoleMock.mockResolvedValue(true);

    render(await ShowTubePage(defaultProps));

    expect(screen.getByTestId("showtube-shell")).toBeDefined();
  });

  it("管理者の場合は ShowTubeShell を表示する", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);

    render(await ShowTubePage(defaultProps));

    expect(screen.getByTestId("showtube-shell")).toBeDefined();
  });

  it("権限チェックを並列で実行する", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);

    await ShowTubePage(defaultProps);

    expect(hasTopAdminRoleMock).toHaveBeenCalledWith("user-1");
    expect(hasPremiumRoleMock).toHaveBeenCalledWith("user-1");
  });

  it("onlives のジャンルリストを ShowTubeShell に渡す", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);

    render(await ShowTubePage(defaultProps));

    const shell = screen.getByTestId("showtube-shell");
    expect(shell.getAttribute("data-genre-count")).toBe("2");
    expect(shell.getAttribute("data-genre-names")).toBe("人気,アイドル");
  });

  it("getOnlives が失敗した場合はジャンルなしで ShowTubeShell を表示する", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    getOnlivesMock.mockRejectedValue(new Error("API error"));

    render(await ShowTubePage(defaultProps));

    expect(screen.getByTestId("showtube-shell").getAttribute("data-genre-count")).toBe("0");
  });

  it("onlives データを ShowTubeLivePage に渡す", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);

    render(await ShowTubePage(defaultProps));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("1");
    expect(livePage.getAttribute("data-has-error")).toBe("false");
    expect(getOnlivesMock).toHaveBeenCalled();
  });

  it("getOnlives が失敗した場合は hasError=true を ShowTubeLivePage に渡す", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);
    getOnlivesMock.mockRejectedValue(new Error("API error"));

    render(await ShowTubePage(defaultProps));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("0");
    expect(livePage.getAttribute("data-has-error")).toBe("true");
  });

  it("genre パラメータが指定された場合は該当ジャンルのルームのみ渡す", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);

    render(await ShowTubePage({ searchParams: Promise.resolve({ genre: "0" }) }));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("1");
  });

  it("genre パラメータが存在しないジャンルIDの場合はルームなしで渡す", async () => {
    authMock.mockResolvedValue(session);
    hasTopAdminRoleMock.mockResolvedValue(true);

    render(await ShowTubePage({ searchParams: Promise.resolve({ genre: "999" }) }));

    const livePage = screen.getByTestId("showtube-live-page");
    expect(livePage.getAttribute("data-items-count")).toBe("0");
  });
});
