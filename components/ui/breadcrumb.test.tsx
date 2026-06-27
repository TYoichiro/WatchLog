import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";

afterEach(() => {
  cleanup();
});

describe("Breadcrumb", () => {
  it("aria-label='breadcrumb' の nav 要素でレンダリングされる", () => {
    render(<Breadcrumb />);
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeDefined();
  });

  it("BreadcrumbList が data-slot='breadcrumb-list' でレンダリングされる", () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList />
      </Breadcrumb>,
    );
    expect(container.querySelector('[data-slot="breadcrumb-list"]')).toBeDefined();
  });

  it("BreadcrumbItem が data-slot='breadcrumb-item' でレンダリングされる", () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>アイテム</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(container.querySelector('[data-slot="breadcrumb-item"]')).toBeDefined();
  });

  it("BreadcrumbLink がリンクとして描画され href を持つ", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/home">ホーム</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    const link = screen.getByRole("link", { name: "ホーム" });
    expect(link.getAttribute("href")).toBe("/home");
  });

  it("BreadcrumbPage が aria-current='page' を持つ", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>現在のページ</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    const page = screen.getByText("現在のページ");
    expect(page.getAttribute("aria-current")).toBe("page");
    expect(page.getAttribute("aria-disabled")).toBe("true");
  });

  it("BreadcrumbSeparator がデフォルトアイコンを描画する", () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbSeparator />
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(container.querySelector('[data-slot="breadcrumb-separator"]')).toBeDefined();
  });

  it("BreadcrumbSeparator にカスタム children を渡せる", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByText("/")).toBeDefined();
  });

  it("BreadcrumbEllipsis が data-slot='breadcrumb-ellipsis' でレンダリングされる", () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(container.querySelector('[data-slot="breadcrumb-ellipsis"]')).toBeDefined();
  });

  it("全コンポーネントを組み合わせて描画できる", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/home">ホーム</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>設定</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByRole("link", { name: "ホーム" })).toBeDefined();
    expect(screen.getByText("設定")).toBeDefined();
  });
});
