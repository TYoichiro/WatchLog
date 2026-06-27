import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";

afterEach(() => {
  cleanup();
});

describe("Switch", () => {
  it("data-slot='switch' でレンダリングされる", () => {
    const { container } = render(<Switch />);
    expect(container.querySelector('[data-slot="switch"]')).toBeDefined();
  });

  it("デフォルト size='default' が data-size に反映される", () => {
    const { container } = render(<Switch />);
    expect(container.querySelector('[data-slot="switch"]')?.getAttribute("data-size")).toBe("default");
  });

  it("size='sm' が data-size='sm' に反映される", () => {
    const { container } = render(<Switch size="sm" />);
    expect(container.querySelector('[data-slot="switch"]')?.getAttribute("data-size")).toBe("sm");
  });

  it("初期状態では aria-checked='false'", () => {
    const { container } = render(<Switch />);
    expect(container.querySelector('[data-slot="switch"]')?.getAttribute("aria-checked")).toBe("false");
  });

  it("checked=true 時は aria-checked='true'", () => {
    const { container } = render(<Switch checked onCheckedChange={vi.fn()} />);
    expect(container.querySelector('[data-slot="switch"]')?.getAttribute("aria-checked")).toBe("true");
  });

  it("クリックすると onCheckedChange(true) が呼ばれる", () => {
    const handleChange = vi.fn();
    const { container } = render(<Switch onCheckedChange={handleChange} />);
    fireEvent.click(container.querySelector('[data-slot="switch"]') as HTMLElement);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("disabled 時はクリックしても onCheckedChange が呼ばれない", () => {
    const handleChange = vi.fn();
    const { container } = render(<Switch disabled onCheckedChange={handleChange} />);
    fireEvent.click(container.querySelector('[data-slot="switch"]') as HTMLElement);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
