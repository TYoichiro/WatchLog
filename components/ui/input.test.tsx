import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "./input";

afterEach(() => {
  cleanup();
});

describe("Input", () => {
  it("data-slot='input' でレンダリングされる", () => {
    const { container } = render(<Input />);
    expect(container.querySelector('[data-slot="input"]')).toBeDefined();
  });

  it("type 属性が反映される", () => {
    const { container } = render(<Input type="email" />);
    expect(container.querySelector("input")?.getAttribute("type")).toBe("email");
  });

  it("type='password' が反映される", () => {
    const { container } = render(<Input type="password" />);
    expect(container.querySelector("input")?.getAttribute("type")).toBe("password");
  });

  it("placeholder が表示される", () => {
    render(<Input placeholder="メールアドレスを入力" />);
    expect(screen.getByPlaceholderText("メールアドレスを入力")).toBeDefined();
  });

  it("value の入力を受け付ける", () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "テスト" } });
    expect(handleChange).toHaveBeenCalledOnce();
  });

  it("disabled 時は input が無効化される", () => {
    const { container } = render(<Input disabled />);
    expect(container.querySelector("input")?.disabled).toBe(true);
  });

  it("カスタム className が適用される", () => {
    const { container } = render(<Input className="custom-input" />);
    expect(container.querySelector("input")?.className).toContain("custom-input");
  });
});
