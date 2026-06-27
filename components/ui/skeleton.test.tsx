import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Skeleton } from "./skeleton";

afterEach(() => {
  cleanup();
});

describe("Skeleton", () => {
  it("data-slot='skeleton' でレンダリングされる", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeDefined();
  });

  it("animate-pulse クラスが含まれる", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('[data-slot="skeleton"]')?.className).toContain("animate-pulse");
  });

  it("カスタム className が適用される", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const el = container.querySelector('[data-slot="skeleton"]');
    expect(el?.className).toContain("h-4");
    expect(el?.className).toContain("w-32");
  });
});
