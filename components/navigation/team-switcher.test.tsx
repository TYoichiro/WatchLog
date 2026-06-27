import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tv } from "lucide-react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TeamSwitcher } from "./team-switcher";

function renderWithSidebar(ui: React.ReactElement) {
  return render(<SidebarProvider>{ui}</SidebarProvider>);
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

const teams = [
  { name: "チーム A", logo: Tv, plan: "プロ" },
  { name: "チーム B", logo: Tv, plan: "スタンダード" },
];

describe("TeamSwitcher", () => {
  describe("アクティブチームの表示", () => {
    it("最初のチームをアクティブとして表示する", () => {
      renderWithSidebar(<TeamSwitcher teams={teams} />);
      expect(screen.getByText("チーム A")).toBeDefined();
    });

    it("アクティブチームのプランを表示する", () => {
      renderWithSidebar(<TeamSwitcher teams={teams} />);
      expect(screen.getByText("プロ")).toBeDefined();
    });
  });

  describe("空の teams 配列", () => {
    it("teams が空のときは何もレンダリングしない", () => {
      const { container } = renderWithSidebar(<TeamSwitcher teams={[]} />);
      // SidebarProvider の wrapper div のみ残る
      expect(container.querySelector("button")).toBeNull();
    });
  });

  describe("単一チーム", () => {
    it("チームが1件のみのとき名前とプランを表示する", () => {
      renderWithSidebar(
        <TeamSwitcher teams={[{ name: "WatchLog", logo: Tv, plan: "フリー" }]} />,
      );
      expect(screen.getByText("WatchLog")).toBeDefined();
      expect(screen.getByText("フリー")).toBeDefined();
    });
  });
});
