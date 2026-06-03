import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LiveSettingsModal } from "./live-settings-modal";

describe("LiveSettingsModal", () => {
  it("設定ボタンが表示される", () => {
    render(<LiveSettingsModal showNotice={true} onShowNoticeChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "設定" })).toBeDefined();
  });

  it("初期状態ではダイアログが表示されない", () => {
    render(<LiveSettingsModal showNotice={true} onShowNoticeChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("設定ボタンをクリックするとダイアログが開く", () => {
    render(<LiveSettingsModal showNotice={true} onShowNoticeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("ダイアログに「設定」タイトルが表示される", () => {
    render(<LiveSettingsModal showNotice={true} onShowNoticeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(screen.getByText("設定")).toBeDefined();
  });

  it("ダイアログに「コメント設定」セクションが表示される", () => {
    render(<LiveSettingsModal showNotice={true} onShowNoticeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(screen.getByText("コメント設定")).toBeDefined();
  });

  it("ダイアログに「お知らせ系通知」ラベルが表示される", () => {
    render(<LiveSettingsModal showNotice={true} onShowNoticeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(screen.getByText("お知らせ系通知")).toBeDefined();
  });

  it("showNotice=true のときスイッチが ON になっている", () => {
    render(<LiveSettingsModal showNotice={true} onShowNoticeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    const switchEl = screen.getByRole("switch");
    expect(switchEl.getAttribute("aria-checked")).toBe("true");
  });

  it("showNotice=false のときスイッチが OFF になっている", () => {
    render(<LiveSettingsModal showNotice={false} onShowNoticeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    const switchEl = screen.getByRole("switch");
    expect(switchEl.getAttribute("aria-checked")).toBe("false");
  });

  it("スイッチをクリックすると onShowNoticeChange が呼ばれる", () => {
    const onShowNoticeChange = vi.fn();
    render(<LiveSettingsModal showNotice={true} onShowNoticeChange={onShowNoticeChange} />);
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    fireEvent.click(screen.getByRole("switch"));
    expect(onShowNoticeChange).toHaveBeenCalledTimes(1);
    expect(onShowNoticeChange).toHaveBeenCalledWith(false);
  });

  it("showNotice=false のときスイッチをクリックすると true で呼ばれる", () => {
    const onShowNoticeChange = vi.fn();
    render(<LiveSettingsModal showNotice={false} onShowNoticeChange={onShowNoticeChange} />);
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    fireEvent.click(screen.getByRole("switch"));
    expect(onShowNoticeChange).toHaveBeenCalledWith(true);
  });
});
