import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "./dialog";

afterEach(() => {
  cleanup();
});

describe("Dialog", () => {
  it("defaultOpen=true でダイアログが表示される", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>ダイアログタイトル</DialogTitle>
          <DialogDescription>ダイアログの説明</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("ダイアログタイトル")).toBeDefined();
    expect(screen.getByText("ダイアログの説明")).toBeDefined();
  });

  it("open=false ではコンテンツが表示されない", () => {
    render(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>ダイアログタイトル</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByText("ダイアログタイトル")).toBeNull();
  });

  it("data-slot='dialog-content' が設定される", () => {
    const { container } = render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>タイトル</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(container.querySelector('[data-slot="dialog-content"]')).toBeDefined();
  });

  it("DialogFooter が data-slot='dialog-footer' でレンダリングされる", () => {
    const { container } = render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>タイトル</DialogTitle>
          <DialogFooter>フッター</DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    expect(container.querySelector('[data-slot="dialog-footer"]')).toBeDefined();
  });

  it("カスタム className が DialogContent に適用される", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent className="custom-dialog">
          <DialogTitle>タイトル</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(document.body.querySelector('[data-slot="dialog-content"]')?.className).toContain("custom-dialog");
  });
});
