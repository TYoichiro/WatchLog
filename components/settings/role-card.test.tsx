import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RoleCard } from "./role-card";

afterEach(() => {
  cleanup();
});

describe("RoleCard", () => {
  it("「権限」という見出しを表示する", () => {
    render(<RoleCard roleLabel="一般" />);
    expect(screen.getByRole("heading", { level: 2, name: "権限" })).toBeDefined();
  });

  it("渡した roleLabel を表示する", () => {
    render(<RoleCard roleLabel="プレミアム" />);
    expect(screen.getByText("プレミアム")).toBeDefined();
  });

  it("「あなたは...ユーザーです」という文を含む", () => {
    render(<RoleCard roleLabel="管理者" />);
    const paragraph = screen.getByText(/あなたは.*ユーザーです/);
    expect(paragraph).toBeDefined();
    expect(paragraph.textContent).toContain("管理者");
  });

  it("異なる roleLabel でも正しく表示する", () => {
    render(<RoleCard roleLabel="一般" />);
    expect(screen.getByText("一般")).toBeDefined();
  });
});
