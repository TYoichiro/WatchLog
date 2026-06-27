import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Folder } from "lucide-react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { NavProjects } from "./nav-projects";

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

const projects = [
  { name: "プロジェクト A", url: "/projects/a", icon: Folder },
  { name: "プロジェクト B", url: "#", icon: Folder },
];

describe("NavProjects", () => {
  describe("プロジェクト一覧", () => {
    it("各プロジェクト名を表示する", () => {
      renderWithSidebar(<NavProjects projects={projects} />);
      expect(screen.getByText("プロジェクト A")).toBeDefined();
      expect(screen.getByText("プロジェクト B")).toBeDefined();
    });

    it("通常 URL のプロジェクトはリンクとして描画される", () => {
      renderWithSidebar(<NavProjects projects={projects} />);
      const link = screen.getByRole("link", { name: /プロジェクト A/ });
      expect(link.getAttribute("href")).toBe("/projects/a");
    });

    it("URL が '#' のプロジェクトはボタンとして描画される", () => {
      renderWithSidebar(<NavProjects projects={projects} />);
      expect(
        screen.getByRole("button", { name: /プロジェクト B/ }),
      ).toBeDefined();
    });

    it("最下部に「More」ボタンを表示する", () => {
      renderWithSidebar(<NavProjects projects={projects} />);
      expect(screen.getAllByText("More").length).toBeGreaterThan(0);
    });

    it("プロジェクトリストが空のとき「More」ボタンのみ表示する", () => {
      renderWithSidebar(<NavProjects projects={[]} />);
      expect(screen.getAllByText("More").length).toBeGreaterThan(0);
      expect(screen.queryByRole("link")).toBeNull();
    });
  });
});
