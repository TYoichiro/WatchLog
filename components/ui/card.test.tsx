import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

afterEach(() => {
  cleanup();
});

describe("Card", () => {
  it("data-slot='card' でレンダリングされる", () => {
    const { container } = render(<Card>カード</Card>);
    expect(container.querySelector('[data-slot="card"]')).toBeDefined();
  });

  it("デフォルト size='default' が data-size に反映される", () => {
    const { container } = render(<Card>カード</Card>);
    expect(container.querySelector('[data-slot="card"]')?.getAttribute("data-size")).toBe("default");
  });

  it("size='sm' が data-size='sm' に反映される", () => {
    const { container } = render(<Card size="sm">カード</Card>);
    expect(container.querySelector('[data-slot="card"]')?.getAttribute("data-size")).toBe("sm");
  });

  it("CardHeader が data-slot='card-header' でレンダリングされる", () => {
    const { container } = render(<CardHeader>ヘッダー</CardHeader>);
    expect(container.querySelector('[data-slot="card-header"]')).toBeDefined();
  });

  it("CardTitle がテキストを表示する", () => {
    render(<CardTitle>タイトル</CardTitle>);
    expect(screen.getByText("タイトル")).toBeDefined();
  });

  it("CardDescription が data-slot='card-description' でレンダリングされる", () => {
    const { container } = render(<CardDescription>説明</CardDescription>);
    expect(container.querySelector('[data-slot="card-description"]')).toBeDefined();
  });

  it("CardAction が data-slot='card-action' でレンダリングされる", () => {
    const { container } = render(<CardAction>アクション</CardAction>);
    expect(container.querySelector('[data-slot="card-action"]')).toBeDefined();
  });

  it("CardContent が data-slot='card-content' でレンダリングされる", () => {
    const { container } = render(<CardContent>コンテンツ</CardContent>);
    expect(container.querySelector('[data-slot="card-content"]')).toBeDefined();
  });

  it("CardFooter が data-slot='card-footer' でレンダリングされる", () => {
    const { container } = render(<CardFooter>フッター</CardFooter>);
    expect(container.querySelector('[data-slot="card-footer"]')).toBeDefined();
  });

  it("全サブコンポーネントを組み合わせて描画できる", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>タイトル</CardTitle>
          <CardDescription>説明</CardDescription>
        </CardHeader>
        <CardContent>コンテンツ</CardContent>
        <CardFooter>フッター</CardFooter>
      </Card>,
    );
    expect(screen.getByText("タイトル")).toBeDefined();
    expect(screen.getByText("説明")).toBeDefined();
    expect(screen.getByText("コンテンツ")).toBeDefined();
    expect(screen.getByText("フッター")).toBeDefined();
  });

  it("カスタム className が適用される", () => {
    const { container } = render(<Card className="custom-card">カード</Card>);
    expect(container.querySelector('[data-slot="card"]')?.className).toContain("custom-card");
  });
});
