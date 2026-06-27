import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";

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

const testUser = {
  name: "山田太郎",
  email: "yamada@example.com",
  avatar: "https://example.com/avatar.jpg",
};

describe("NavUser", () => {
  describe("ユーザー情報の表示", () => {
    it("ユーザー名を表示する", () => {
      renderWithSidebar(<NavUser user={testUser} />);
      expect(screen.getAllByText("山田太郎").length).toBeGreaterThan(0);
    });

    it("メールアドレスを表示する", () => {
      renderWithSidebar(<NavUser user={testUser} />);
      expect(screen.getAllByText("yamada@example.com").length).toBeGreaterThan(0);
    });

    it("アバターフォールバック「CN」を表示する (jsdom では画像がロードされないため)", () => {
      renderWithSidebar(<NavUser user={testUser} />);
      expect(screen.getAllByText("CN").length).toBeGreaterThan(0);
    });
  });

  describe("異なるユーザーデータ", () => {
    it("別のユーザー名でも正しく表示する", () => {
      const anotherUser = {
        name: "鈴木花子",
        email: "suzuki@example.com",
        avatar: "",
      };
      renderWithSidebar(<NavUser user={anotherUser} />);
      expect(screen.getAllByText("鈴木花子").length).toBeGreaterThan(0);
      expect(screen.getAllByText("suzuki@example.com").length).toBeGreaterThan(0);
    });
  });
});
