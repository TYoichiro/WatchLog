import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { AppShell } from "./app-sidebar";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AppShell", () => {
  describe("ナビゲーション項目", () => {
    it("基本ナビゲーション項目を表示する", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell />);

      expect(screen.getAllByText("ホーム").length).toBeGreaterThan(0);
      expect(screen.getAllByText("ログ閲覧").length).toBeGreaterThan(0);
      expect(screen.getAllByText("ブロック").length).toBeGreaterThan(0);
      expect(screen.getAllByText("設定").length).toBeGreaterThan(0);
    });

    it("デフォルトでは管理者リンクを表示しない", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell />);

      expect(screen.queryByText("ユーザー一覧")).toBeNull();
      expect(screen.queryByText("ルーム一覧")).toBeNull();
      expect(screen.queryByText("メンテナンス")).toBeNull();
      expect(screen.queryByText("お知らせ")).toBeNull();
    });

    it("isAdmin=true のとき管理者リンクを表示する", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell isAdmin />);

      expect(screen.getAllByText("ユーザー一覧").length).toBeGreaterThan(0);
      expect(screen.getAllByText("ルーム一覧").length).toBeGreaterThan(0);
      expect(screen.getAllByText("メンテナンス").length).toBeGreaterThan(0);
      expect(screen.getAllByText("お知らせ").length).toBeGreaterThan(0);
    });

    it("isPremium=true のとき ShowTube リンクを表示する", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell isPremium />);

      expect(screen.getAllByText("ShowTube").length).toBeGreaterThan(0);
    });

    it("isAdmin=true のとき ShowTube リンクを表示する", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell isAdmin />);

      expect(screen.getAllByText("ShowTube").length).toBeGreaterThan(0);
    });

    it("通常ユーザーは ShowTube リンクを表示しない", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell />);

      expect(screen.queryByText("ShowTube")).toBeNull();
    });

    it("showMenu=false のときナビゲーション項目を表示しない", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell showMenu={false} />);

      expect(screen.queryByText("ホーム")).toBeNull();
      expect(screen.queryByText("ログ閲覧")).toBeNull();
      expect(screen.queryByText("ブロック")).toBeNull();
      expect(screen.queryByText("設定")).toBeNull();
    });
  });

  describe("アクティブナビゲーション", () => {
    const cases = [
      { pathname: "/dashboard", label: "ホーム" },
      { pathname: "/logs", label: "ログ閲覧" },
      { pathname: "/logs/123", label: "ログ閲覧" },
      { pathname: "/block", label: "ブロック" },
      { pathname: "/settings", label: "設定" },
      { pathname: "/settings/profile", label: "設定" },
    ];

    for (const { pathname, label } of cases) {
      it(`${pathname} のとき ${label} がアクティブになる`, () => {
        vi.mocked(usePathname).mockReturnValue(pathname);
        render(<AppShell />);

        const activeElements = document.querySelectorAll("[aria-current='page']");
        const hasActiveLabel = Array.from(activeElements).some((el) =>
          el.textContent?.includes(label),
        );
        expect(hasActiveLabel).toBe(true);
      });
    }

    it("/admin/rooms のときルーム一覧がアクティブになる", () => {
      vi.mocked(usePathname).mockReturnValue("/admin/rooms");
      render(<AppShell isAdmin />);

      const activeElements = document.querySelectorAll("[aria-current='page']");
      const hasActiveLabel = Array.from(activeElements).some((el) =>
        el.textContent?.includes("ルーム一覧"),
      );
      expect(hasActiveLabel).toBe(true);
    });

    it("/admin/maintenance のときメンテナンスがアクティブになる", () => {
      vi.mocked(usePathname).mockReturnValue("/admin/maintenance");
      render(<AppShell isAdmin />);

      const activeElements = document.querySelectorAll("[aria-current='page']");
      const hasActiveLabel = Array.from(activeElements).some((el) =>
        el.textContent?.includes("メンテナンス"),
      );
      expect(hasActiveLabel).toBe(true);
    });

    it("/admin/notices のときお知らせがアクティブになる", () => {
      vi.mocked(usePathname).mockReturnValue("/admin/notices");
      render(<AppShell isAdmin />);

      const activeElements = document.querySelectorAll("[aria-current='page']");
      const hasActiveLabel = Array.from(activeElements).some((el) =>
        el.textContent?.includes("お知らせ"),
      );
      expect(hasActiveLabel).toBe(true);
    });

    it("/admin/users のときユーザー一覧がアクティブになる", () => {
      vi.mocked(usePathname).mockReturnValue("/admin/users");
      render(<AppShell isAdmin />);

      const activeElements = document.querySelectorAll("[aria-current='page']");
      const hasActiveLabel = Array.from(activeElements).some((el) =>
        el.textContent?.includes("ユーザー一覧"),
      );
      expect(hasActiveLabel).toBe(true);
    });

    it("/showtube のとき ShowTube がアクティブになる", () => {
      vi.mocked(usePathname).mockReturnValue("/showtube");
      render(<AppShell isPremium />);

      const activeElements = document.querySelectorAll("[aria-current='page']");
      const hasActiveLabel = Array.from(activeElements).some((el) =>
        el.textContent?.includes("ShowTube"),
      );
      expect(hasActiveLabel).toBe(true);
    });
  });

  describe("ヘッダー", () => {
    it("デフォルトタイトル WatchLog を表示する", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell />);

      expect(screen.getByRole("heading", { level: 1, name: "WatchLog" })).toBeDefined();
    });

    it("title プロパティを表示する", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell title="テストタイトル" />);

      expect(screen.getByRole("heading", { level: 1, name: "テストタイトル" })).toBeDefined();
    });

    it("/dashboard でブランドリンクが有効になる", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell />);

      const brandLink = screen.getByRole("link", { name: "WatchLog" });
      expect(brandLink.getAttribute("href")).toBe("/dashboard");
    });

    it("/onlive/* でブランドリンクが無効になる", () => {
      vi.mocked(usePathname).mockReturnValue("/onlive/test-room");
      render(<AppShell showMenu={false} />);

      expect(screen.queryByRole("link", { name: "WatchLog" })).toBeNull();
      expect(screen.getByRole("heading", { level: 1, name: "WatchLog" })).toBeDefined();
    });

    it("showMenu=false のときメニューボタンを表示しない", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell showMenu={false} />);

      expect(screen.queryByLabelText("メニューを切り替える")).toBeNull();
    });

    it("showMenu=true のときメニューボタンを表示する", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell showMenu />);

      expect(screen.getByLabelText("メニューを切り替える")).toBeDefined();
    });
  });

  describe("homeLabel", () => {
    it("homeLabel が指定されるとダッシュボード項目のラベルを置き換える", () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      render(<AppShell homeLabel="マイルーム" />);

      expect(screen.getAllByText("マイルーム").length).toBeGreaterThan(0);
      expect(screen.queryByText("ホーム")).toBeNull();
    });
  });

  describe("サインアウト", () => {
    it("ログアウトボタンをクリックすると signOut を呼ぶ", async () => {
      vi.mocked(usePathname).mockReturnValue("/dashboard");
      const mockSignOut = vi.mocked(signOut);
      render(<AppShell />);

      const logoutButtons = screen.getAllByRole("button", { name: /ログアウト/ });
      fireEvent.click(logoutButtons[0]);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: "/" });
      });
    });
  });
});
