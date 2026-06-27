import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

afterEach(() => {
  cleanup();
});

describe("DropdownMenu", () => {
  describe("開閉", () => {
    it("トリガーへの pointerDown でメニューが表示される", async () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>アイテム1</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      fireEvent.pointerDown(screen.getByText("開く"), { button: 0 });
      await screen.findByText("アイテム1");
      expect(screen.getByText("アイテム1")).toBeDefined();
    });

    it("defaultOpen=true で初期からメニューが表示される", () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>初期表示</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      expect(screen.getByText("初期表示")).toBeDefined();
    });
  });

  describe("DropdownMenuItem", () => {
    it("クリックで onSelect が呼ばれる", () => {
      const handleSelect = vi.fn();
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={handleSelect}>実行</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      fireEvent.click(screen.getByText("実行"));
      expect(handleSelect).toHaveBeenCalledOnce();
    });

    it("variant='destructive' が data-variant に反映される", () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem variant="destructive">削除</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      const item = screen.getByText("削除").closest('[data-slot="dropdown-menu-item"]');
      expect(item?.getAttribute("data-variant")).toBe("destructive");
    });
  });

  describe("DropdownMenuLabel", () => {
    it("ラベルテキストが表示される", () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>カテゴリ</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      expect(screen.getByText("カテゴリ")).toBeDefined();
    });
  });

  describe("DropdownMenuShortcut", () => {
    it("ショートカットテキストが表示される", () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              コピー
              <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      expect(screen.getByText("⌘C")).toBeDefined();
    });
  });

  describe("DropdownMenuSeparator", () => {
    it("data-slot='dropdown-menu-separator' でレンダリングされる", () => {
      const { container } = render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>アイテム1</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>アイテム2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      expect(container.querySelector('[data-slot="dropdown-menu-separator"]')).toBeDefined();
    });
  });

  describe("DropdownMenuCheckboxItem", () => {
    it("チェック済みアイテムが表示される", () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked>オプション</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      expect(screen.getByText("オプション")).toBeDefined();
    });
  });

  describe("DropdownMenuRadioGroup", () => {
    it("ラジオアイテムが表示される", () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="a">
              <DropdownMenuRadioItem value="a">選択肢A</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="b">選択肢B</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      expect(screen.getByText("選択肢A")).toBeDefined();
      expect(screen.getByText("選択肢B")).toBeDefined();
    });
  });

  describe("DropdownMenuSub", () => {
    it("サブトリガーが表示される", () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>開く</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>サブメニュー</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>サブアイテム</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      expect(screen.getByText("サブメニュー")).toBeDefined();
    });
  });
});
