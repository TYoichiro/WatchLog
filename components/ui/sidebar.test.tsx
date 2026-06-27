import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./sidebar";

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

function renderWithSidebar(ui: React.ReactElement, defaultOpen = true) {
  return render(<SidebarProvider defaultOpen={defaultOpen}>{ui}</SidebarProvider>);
}

describe("SidebarProvider", () => {
  it("子要素を描画する", () => {
    renderWithSidebar(<div>コンテンツ</div>);
    expect(screen.getByText("コンテンツ")).toBeDefined();
  });

  it("data-slot='sidebar-wrapper' のラッパーでレンダリングされる", () => {
    const { container } = renderWithSidebar(<div>内容</div>);
    expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toBeDefined();
  });
});

describe("useSidebar", () => {
  it("SidebarProvider 外で使用するとエラーをスローする", () => {
    function TestComponent() {
      useSidebar();
      return null;
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow(
      "useSidebar must be used within a SidebarProvider.",
    );
    consoleError.mockRestore();
  });
});

describe("SidebarTrigger", () => {
  it("クリックするとサイドバーの展開状態がトグルされる", () => {
    const { container } = renderWithSidebar(
      <>
        <Sidebar>
          <SidebarContent />
        </Sidebar>
        <SidebarTrigger />
      </>,
    );
    const sidebarEl = container.querySelector('[data-slot="sidebar"]')!;
    expect(sidebarEl.getAttribute("data-state")).toBe("expanded");
    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    expect(sidebarEl.getAttribute("data-state")).toBe("collapsed");
  });

  it("折りたたまれた状態から再クリックで展開される", () => {
    const { container } = renderWithSidebar(
      <>
        <Sidebar>
          <SidebarContent />
        </Sidebar>
        <SidebarTrigger />
      </>,
      false,
    );
    const sidebarEl = container.querySelector('[data-slot="sidebar"]')!;
    expect(sidebarEl.getAttribute("data-state")).toBe("collapsed");
    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    expect(sidebarEl.getAttribute("data-state")).toBe("expanded");
  });
});

describe("キーボードショートカット", () => {
  it("Ctrl+B でサイドバーをトグルできる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent />
      </Sidebar>,
    );
    const sidebarEl = container.querySelector('[data-slot="sidebar"]')!;
    expect(sidebarEl.getAttribute("data-state")).toBe("expanded");
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(sidebarEl.getAttribute("data-state")).toBe("collapsed");
  });

  it("Meta+B でサイドバーをトグルできる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent />
      </Sidebar>,
    );
    const sidebarEl = container.querySelector('[data-slot="sidebar"]')!;
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(sidebarEl.getAttribute("data-state")).toBe("collapsed");
  });
});

describe("Sidebar", () => {
  it("data-slot='sidebar' でレンダリングされる", () => {
    const { container } = renderWithSidebar(<Sidebar />);
    expect(container.querySelector('[data-slot="sidebar"]')).toBeDefined();
  });

  it("collapsible='none' の場合は data-state を持たない", () => {
    const { container } = renderWithSidebar(
      <Sidebar collapsible="none">
        <SidebarContent />
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBeNull();
  });

  it("SidebarHeader が data-slot='sidebar-header' でレンダリングされる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarHeader>ヘッダー</SidebarHeader>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-header"]')).toBeDefined();
  });

  it("SidebarFooter が data-slot='sidebar-footer' でレンダリングされる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarFooter>フッター</SidebarFooter>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-footer"]')).toBeDefined();
  });

  it("SidebarContent が data-slot='sidebar-content' でレンダリングされる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>コンテンツ</SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-content"]')).toBeDefined();
  });

  it("SidebarGroup が data-slot='sidebar-group' でレンダリングされる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarGroup />
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-group"]')).toBeDefined();
  });

  it("SidebarGroupLabel がラベルテキストを表示する", () => {
    renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>グループラベル</SidebarGroupLabel>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>,
    );
    expect(screen.getByText("グループラベル")).toBeDefined();
  });

  it("SidebarGroupContent が data-slot='sidebar-group-content' でレンダリングされる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent />
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-group-content"]')).toBeDefined();
  });
});

describe("SidebarMenu", () => {
  it("SidebarMenu と SidebarMenuItem がレンダリングされる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>アイテム</SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-menu"]')).toBeDefined();
    expect(container.querySelector('[data-slot="sidebar-menu-item"]')).toBeDefined();
  });

  it("SidebarMenuButton がボタンとして描画される", () => {
    renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>メニューボタン</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>,
    );
    expect(screen.getByRole("button", { name: "メニューボタン" })).toBeDefined();
  });

  it("SidebarMenuButton isActive=true が data-active に反映される", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive>アクティブ</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>,
    );
    const btn = container.querySelector('[data-slot="sidebar-menu-button"]');
    expect(btn?.getAttribute("data-active")).toBe("true");
  });

  it("SidebarMenuBadge がバッジを表示する", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>メニュー</SidebarMenuButton>
              <SidebarMenuBadge>3</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-menu-badge"]')).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("SidebarMenuAction がレンダリングされる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>メニュー</SidebarMenuButton>
              <SidebarMenuAction>アクション</SidebarMenuAction>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-menu-action"]')).toBeDefined();
  });

  it("SidebarMenuSkeleton が描画される", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuSkeleton />
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-menu-skeleton"]')).toBeDefined();
  });

  it("SidebarMenuSkeleton showIcon=true でアイコン骨格が表示される", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-sidebar="menu-skeleton-icon"]')).toBeDefined();
  });

  it("SidebarMenuSub がレンダリングされる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton>サブアイテム</SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-menu-sub"]')).toBeDefined();
    expect(screen.getByText("サブアイテム")).toBeDefined();
  });
});

describe("SidebarInset", () => {
  it("main 要素として描画される", () => {
    const { container } = renderWithSidebar(<SidebarInset>メインコンテンツ</SidebarInset>);
    expect(container.querySelector('[data-slot="sidebar-inset"]')).toBeDefined();
    expect(screen.getByText("メインコンテンツ")).toBeDefined();
  });
});

describe("SidebarInput", () => {
  it("インプットとして描画される", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarInput placeholder="検索" />
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-input"]')).toBeDefined();
    expect(screen.getByPlaceholderText("検索")).toBeDefined();
  });
});

describe("SidebarSeparator", () => {
  it("data-slot='sidebar-separator' でレンダリングされる", () => {
    const { container } = renderWithSidebar(
      <Sidebar>
        <SidebarContent>
          <SidebarSeparator />
        </SidebarContent>
      </Sidebar>,
    );
    expect(container.querySelector('[data-slot="sidebar-separator"]')).toBeDefined();
  });
});
