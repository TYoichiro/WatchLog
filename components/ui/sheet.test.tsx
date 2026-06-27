import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

afterEach(() => {
  cleanup();
});

describe("Sheet", () => {
  it("トリガーをクリックするとシートが表示される", () => {
    render(
      <Sheet>
        <SheetTrigger>開く</SheetTrigger>
        <SheetContent>
          <SheetTitle>シートタイトル</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    fireEvent.click(screen.getByText("開く"));
    expect(screen.getByText("シートタイトル")).toBeDefined();
  });

  it("defaultOpen=true で初期からシートが表示される", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>タイトル</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("タイトル")).toBeDefined();
  });

  it("showCloseButton=false の場合は閉じるボタンが表示されない", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent showCloseButton={false}>
          <SheetTitle>タイトル</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
  });

  it("side='left' が data-side='left' に反映される", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent side="left">
          <SheetTitle>タイトル</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(document.body.querySelector('[data-slot="sheet-content"]')?.getAttribute("data-side")).toBe("left");
  });

  it("side='bottom' が data-side='bottom' に反映される", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent side="bottom">
          <SheetTitle>タイトル</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(document.body.querySelector('[data-slot="sheet-content"]')?.getAttribute("data-side")).toBe("bottom");
  });

  it("SheetHeader が data-slot='sheet-header' でレンダリングされる", () => {
    const { container } = render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>タイトル</SheetTitle>
          <SheetHeader>ヘッダー</SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    expect(container.querySelector('[data-slot="sheet-header"]')).toBeDefined();
  });

  it("SheetFooter が data-slot='sheet-footer' でレンダリングされる", () => {
    const { container } = render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>タイトル</SheetTitle>
          <SheetFooter>フッター</SheetFooter>
        </SheetContent>
      </Sheet>,
    );
    expect(container.querySelector('[data-slot="sheet-footer"]')).toBeDefined();
  });

  it("SheetDescription が説明テキストを表示する", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>タイトル</SheetTitle>
          <SheetDescription>説明テキスト</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("説明テキスト")).toBeDefined();
  });
});
