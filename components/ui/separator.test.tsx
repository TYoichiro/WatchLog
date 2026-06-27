import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Separator } from "./separator";

afterEach(() => {
  cleanup();
});

describe("Separator", () => {
  it("data-slot='separator' でレンダリングされる", () => {
    const { container } = render(<Separator />);
    expect(container.querySelector('[data-slot="separator"]')).toBeDefined();
  });

  it("デフォルトは horizontal 方向", () => {
    const { container } = render(<Separator />);
    expect(container.querySelector('[data-slot="separator"]')?.getAttribute("data-orientation")).toBe("horizontal");
  });

  it("orientation='vertical' が反映される", () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(container.querySelector('[data-slot="separator"]')?.getAttribute("data-orientation")).toBe("vertical");
  });

  it("カスタム className が適用される", () => {
    const { container } = render(<Separator className="my-separator" />);
    expect(container.querySelector('[data-slot="separator"]')?.className).toContain("my-separator");
  });
});
