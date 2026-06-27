import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("デフォルトの variant と size でレンダリングされる", () => {
    render(<Button>クリック</Button>);
    const btn = screen.getByRole("button", { name: "クリック" });
    expect(btn).toBeDefined();
    expect(btn.getAttribute("data-slot")).toBe("button");
    expect(btn.getAttribute("data-variant")).toBe("default");
    expect(btn.getAttribute("data-size")).toBe("default");
  });

  it("variant='destructive' が data-variant に反映される", () => {
    render(<Button variant="destructive">削除</Button>);
    const btn = screen.getByRole("button", { name: "削除" });
    expect(btn.getAttribute("data-variant")).toBe("destructive");
  });

  it("variant='outline' が data-variant に反映される", () => {
    render(<Button variant="outline">アウトライン</Button>);
    expect(screen.getByRole("button", { name: "アウトライン" }).getAttribute("data-variant")).toBe("outline");
  });

  it("size='lg' が data-size に反映される", () => {
    render(<Button size="lg">大きいボタン</Button>);
    expect(screen.getByRole("button", { name: "大きいボタン" }).getAttribute("data-size")).toBe("lg");
  });

  it("size='icon' が data-size に反映される", () => {
    render(<Button size="icon">i</Button>);
    expect(screen.getByRole("button", { name: "i" }).getAttribute("data-size")).toBe("icon");
  });

  it("disabled 時はクリックイベントが発火しない", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        無効
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "無効" }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("asChild=true の場合は子要素として描画される", () => {
    render(
      <Button asChild>
        <a href="/test">リンク</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "リンク" });
    expect(link.getAttribute("data-slot")).toBe("button");
    expect(link.getAttribute("href")).toBe("/test");
  });

  it("カスタム className が適用される", () => {
    render(<Button className="custom-class">ボタン</Button>);
    expect(screen.getByRole("button", { name: "ボタン" }).className).toContain("custom-class");
  });

  it("onClick ハンドラーが呼ばれる", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>クリック</Button>);
    fireEvent.click(screen.getByRole("button", { name: "クリック" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
