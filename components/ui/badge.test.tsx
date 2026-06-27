import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "./badge";

afterEach(() => {
  cleanup();
});

describe("Badge", () => {
  it("data-slot='badge' でレンダリングされる", () => {
    const { container } = render(<Badge>バッジ</Badge>);
    expect(container.querySelector('[data-slot="badge"]')).toBeDefined();
  });

  it("テキストコンテンツが表示される", () => {
    render(<Badge>ステータス</Badge>);
    expect(screen.getByText("ステータス")).toBeDefined();
  });

  it("デフォルト variant='default' が data-variant に反映される", () => {
    const { container } = render(<Badge>バッジ</Badge>);
    expect(container.querySelector('[data-slot="badge"]')?.getAttribute("data-variant")).toBe("default");
  });

  it("variant='secondary' が data-variant に反映される", () => {
    const { container } = render(<Badge variant="secondary">バッジ</Badge>);
    expect(container.querySelector('[data-slot="badge"]')?.getAttribute("data-variant")).toBe("secondary");
  });

  it("variant='destructive' が data-variant に反映される", () => {
    const { container } = render(<Badge variant="destructive">バッジ</Badge>);
    expect(container.querySelector('[data-slot="badge"]')?.getAttribute("data-variant")).toBe("destructive");
  });

  it("variant='outline' が data-variant に反映される", () => {
    const { container } = render(<Badge variant="outline">バッジ</Badge>);
    expect(container.querySelector('[data-slot="badge"]')?.getAttribute("data-variant")).toBe("outline");
  });

  it("asChild=true の場合は子要素として描画される", () => {
    render(
      <Badge asChild>
        <a href="/status">ステータス</a>
      </Badge>,
    );
    const link = screen.getByRole("link", { name: "ステータス" });
    expect(link.getAttribute("data-slot")).toBe("badge");
    expect(link.getAttribute("href")).toBe("/status");
  });

  it("カスタム className が適用される", () => {
    const { container } = render(<Badge className="custom-badge">バッジ</Badge>);
    expect(container.querySelector('[data-slot="badge"]')?.className).toContain("custom-badge");
  });
});
