import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Error from "./error";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <>{children}</> : null,
  DialogContent: ({
    children,
    onEscapeKeyDown,
    onPointerDownOutside,
  }: {
    children: ReactNode;
    className?: string;
    onEscapeKeyDown?: (event: KeyboardEvent) => void;
    onPointerDownOutside?: (event: PointerEvent) => void;
  }) => (
    <div
      role="dialog"
      data-on-escape={String(typeof onEscapeKeyDown === "function")}
      data-on-pointer-down-outside={String(typeof onPointerDownOutside === "function")}
    >
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Onlive エラーバウンダリ", () => {
  it("ダイアログが開いた状態で表示される", () => {
    render(<Error />);
    expect(screen.getByRole("dialog")).not.toBeNull();
  });

  it("エラータイトルと説明文が表示される", () => {
    render(<Error />);
    expect(screen.getByRole("heading", { name: "エラーが発生しました" })).not.toBeNull();
    expect(screen.getByText("再読み込みを行います。")).not.toBeNull();
  });

  it("OKボタンが表示される", () => {
    render(<Error />);
    expect(screen.getByRole("button", { name: "OK" })).not.toBeNull();
  });

  it("OKボタンをクリックするとページがリロードされる", () => {
    const reloadMock = vi.fn();
    vi.stubGlobal("location", { reload: reloadMock });

    render(<Error />);
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("ESCキーとダイアログ外クリックの防止ハンドラが設定されている", () => {
    render(<Error />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("data-on-escape")).toBe("true");
    expect(dialog.getAttribute("data-on-pointer-down-outside")).toBe("true");
  });
});
