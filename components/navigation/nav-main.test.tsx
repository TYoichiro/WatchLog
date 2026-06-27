import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Home, Settings } from "lucide-react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavMain } from "./nav-main";

function renderWithSidebar(ui: React.ReactElement) {
  return render(
    <TooltipProvider>
      <SidebarProvider>{ui}</SidebarProvider>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseItems = [
  {
    title: "ホーム",
    url: "/dashboard",
    icon: Home,
    isActive: false,
    items: [{ title: "ダッシュボード", url: "/dashboard" }],
  },
  {
    title: "設定",
    url: "/settings",
    icon: Settings,
    isActive: true,
    items: [
      { title: "プロフィール", url: "/settings/profile" },
      { title: "ログアウト", url: "#" },
    ],
  },
];

describe("NavMain", () => {
  describe("グループラベル", () => {
    it("「WatchLog Menu」ラベルを表示する", () => {
      renderWithSidebar(<NavMain items={baseItems} />);
      expect(screen.getByText("WatchLog Menu")).toBeDefined();
    });
  });

  describe("トップレベルアイテム", () => {
    it("各アイテムのタイトルを表示する", () => {
      renderWithSidebar(<NavMain items={baseItems} />);
      expect(screen.getByText("ホーム")).toBeDefined();
      expect(screen.getByText("設定")).toBeDefined();
    });

    it("アイテムリストが空の場合はメニュー項目を表示しない", () => {
      renderWithSidebar(<NavMain items={[]} />);
      expect(screen.queryByText("ホーム")).toBeNull();
    });
  });

  describe("サブアイテム (isActive=true)", () => {
    it("isActive=true のアイテムのサブアイテムを表示する", () => {
      renderWithSidebar(<NavMain items={baseItems} />);
      expect(screen.getByText("プロフィール")).toBeDefined();
      expect(screen.getByText("ログアウト")).toBeDefined();
    });

    it("通常 URL のサブアイテムはリンクとして描画される", () => {
      renderWithSidebar(<NavMain items={baseItems} />);
      const link = screen.getByRole("link", { name: "プロフィール" });
      expect(link.getAttribute("href")).toBe("/settings/profile");
    });

    it("URL が '#' のサブアイテムはボタンとして描画される", () => {
      renderWithSidebar(<NavMain items={baseItems} />);
      expect(screen.getByRole("button", { name: "ログアウト" })).toBeDefined();
    });
  });

  describe("折りたたみ操作 (isActive=false)", () => {
    it("isActive=false のアイテムは初期状態でサブアイテムを表示しない", () => {
      renderWithSidebar(<NavMain items={baseItems} />);
      expect(screen.queryByText("ダッシュボード")).toBeNull();
    });

    it("トリガーをクリックするとサブアイテムが展開される", async () => {
      renderWithSidebar(<NavMain items={baseItems} />);
      fireEvent.click(screen.getByText("ホーム"));
      expect(await screen.findByText("ダッシュボード")).toBeDefined();
    });
  });
});
