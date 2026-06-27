import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

afterEach(() => {
  cleanup();
});

describe("Checkbox", () => {
  it("data-slot='checkbox' でレンダリングされる", () => {
    const { container } = render(<Checkbox />);
    expect(container.querySelector('[data-slot="checkbox"]')).toBeDefined();
  });

  it("初期状態では aria-checked='false'", () => {
    const { container } = render(<Checkbox />);
    expect(container.querySelector('[data-slot="checkbox"]')?.getAttribute("aria-checked")).toBe("false");
  });

  it("checked=true 時は aria-checked='true'", () => {
    const { container } = render(<Checkbox checked onCheckedChange={vi.fn()} />);
    expect(container.querySelector('[data-slot="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
  });

  it("クリックすると onCheckedChange(true) が呼ばれる", () => {
    const handleChange = vi.fn();
    const { container } = render(<Checkbox onCheckedChange={handleChange} />);
    fireEvent.click(container.querySelector('[data-slot="checkbox"]') as HTMLElement);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("disabled 時はクリックしても onCheckedChange が呼ばれない", () => {
    const handleChange = vi.fn();
    const { container } = render(<Checkbox disabled onCheckedChange={handleChange} />);
    fireEvent.click(container.querySelector('[data-slot="checkbox"]') as HTMLElement);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("カスタム className が適用される", () => {
    const { container } = render(<Checkbox className="custom-check" />);
    expect(container.querySelector('[data-slot="checkbox"]')?.className).toContain("custom-check");
  });
});
