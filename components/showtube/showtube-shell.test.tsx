import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

import { signOut } from "next-auth/react";
import { ShowTubeShell } from "./showtube-shell";

const genres = [
  { genreId: 1, genreName: "音楽" },
  { genreId: 2, genreName: "ゲーム" },
];

function setupMatchMedia(isDesktop = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isDesktop && query.includes("1280px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  setupMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ShowTubeShell", () => {
  describe("ヘッダー", () => {
    it("「ShowTube」リンクをヘッダーに表示する", () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      const links = screen.getAllByRole("link", { name: "ShowTube" });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0].getAttribute("href")).toBe("/showtube");
    });

    it("メニュー切り替えボタンを表示する", () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      expect(
        screen.getByRole("button", { name: "メニューを切り替える" }),
      ).toBeDefined();
    });

    it("APP_VERSION をヘッダーに表示する", () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      expect(screen.getByText(/^v\d+\.\d+\.\d+/)).toBeDefined();
    });
  });

  describe("子要素", () => {
    it("children をメインコンテンツエリアに表示する", () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <p>テストコンテンツ</p>
        </ShowTubeShell>,
      );
      expect(screen.getByText("テストコンテンツ")).toBeDefined();
    });
  });

  describe("サイドバーコンテンツ", () => {
    it("「戻る」リンクを表示する", () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      expect(screen.getAllByRole("link", { name: /戻る/ }).length).toBeGreaterThan(0);
    });

    it("ジャンル名を表示する", () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      expect(screen.getAllByText("音楽").length).toBeGreaterThan(0);
      expect(screen.getAllByText("ゲーム").length).toBeGreaterThan(0);
    });

    it("ジャンルが存在する場合は「ジャンル」セクションヘッダーを表示する", () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      expect(screen.getAllByText("ジャンル").length).toBeGreaterThan(0);
    });

    it("ジャンルが空の場合は「ジャンル」セクションヘッダーを表示しない", () => {
      render(
        <ShowTubeShell genres={[]} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      expect(screen.queryByText("ジャンル")).toBeNull();
    });

    it("selectedGenreId に一致するジャンルに aria-current='page' を付与する", () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={1}>
          <div />
        </ShowTubeShell>,
      );
      const activeLinks = document.querySelectorAll("[aria-current='page']");
      const hasMusic = Array.from(activeLinks).some((el) =>
        el.textContent?.includes("音楽"),
      );
      expect(hasMusic).toBe(true);
    });

    it("selectedGenreId=null のとき ShowTube リンクが aria-current='page' を持つ", () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      const activeLinks = document.querySelectorAll("[aria-current='page']");
      const hasShowTube = Array.from(activeLinks).some((el) =>
        el.textContent?.includes("ShowTube"),
      );
      expect(hasShowTube).toBe(true);
    });
  });

  describe("モバイルサイドバー", () => {
    it("メニューボタンをクリックするとモバイルサイドバーが開く", async () => {
      Object.defineProperty(window, "innerWidth", { writable: true, value: 375 });
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      const menuButton = screen.getByRole("button", { name: "メニューを切り替える" });
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "メニューを閉じる" })).toBeDefined();
      });
    });

    it("「メニューを閉じる」ボタンをクリックするとモバイルサイドバーが閉じる", async () => {
      Object.defineProperty(window, "innerWidth", { writable: true, value: 375 });
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      fireEvent.click(screen.getByRole("button", { name: "メニューを切り替える" }));

      const closeButton = await screen.findByRole("button", { name: "メニューを閉じる" });
      fireEvent.click(closeButton);

      await waitFor(() => {
        const aside = document.querySelector("aside.-translate-x-full");
        expect(aside).not.toBeNull();
      });
    });
  });

  describe("ログアウト", () => {
    it("ログアウトボタンをクリックすると signOut を呼ぶ", async () => {
      render(
        <ShowTubeShell genres={genres} selectedGenreId={null}>
          <div />
        </ShowTubeShell>,
      );
      const logoutButtons = screen.getAllByRole("button", { name: /ログアウト/ });
      fireEvent.click(logoutButtons[0]);

      await waitFor(() => {
        expect(vi.mocked(signOut)).toHaveBeenCalledWith({ redirectTo: "/" });
      });
    });
  });
});
