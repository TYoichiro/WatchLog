import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MaintenancePage, type MaintenanceItem } from "./maintenance-page";

const makeWindow = (overrides: Partial<MaintenanceItem> = {}): MaintenanceItem => ({
  id: "win-1",
  title: "システムメンテナンス",
  message: null,
  startsAt: new Date(Date.now() - 3600000).toISOString(),
  endsAt: new Date(Date.now() + 3600000).toISOString(),
  isEnabled: true,
  createdAt: "2026-05-01T00:00:00.000+09:00",
  updatedAt: "2026-05-01T00:00:00.000+09:00",
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MaintenancePage", () => {
  it("空状態のとき「メンテナンス設定がありません。」を表示する", () => {
    render(<MaintenancePage initialWindows={[]} />);
    expect(screen.getByText("メンテナンス設定がありません。")).toBeDefined();
  });

  it("メンテナンス設定数を見出しに表示する", () => {
    render(<MaintenancePage initialWindows={[makeWindow()]} />);
    expect(screen.getByRole("heading", { name: /メンテナンス設定 1件/ })).toBeDefined();
  });

  it("空のとき見出しに 0件 を表示する", () => {
    render(<MaintenancePage initialWindows={[]} />);
    expect(screen.getByRole("heading", { name: /メンテナンス設定 0件/ })).toBeDefined();
  });

  it("タイトルを表示する", () => {
    render(<MaintenancePage initialWindows={[makeWindow({ title: "DBメンテ" })]} />);
    expect(screen.getByText("DBメンテ")).toBeDefined();
  });

  it("メッセージが設定されている場合は表示する", () => {
    render(<MaintenancePage initialWindows={[makeWindow({ message: "詳細メッセージ" })]} />);
    expect(screen.getByText("詳細メッセージ")).toBeDefined();
  });

  it("メッセージが null の場合は表示しない", () => {
    render(<MaintenancePage initialWindows={[makeWindow({ message: null })]} />);
    expect(screen.queryByText("詳細メッセージ")).toBeNull();
  });

  it("開始〜終了中のウィンドウに「アクティブ」バッジを表示する", () => {
    const startsAt = new Date(Date.now() - 3600000).toISOString();
    const endsAt = new Date(Date.now() + 3600000).toISOString();
    render(
      <MaintenancePage initialWindows={[makeWindow({ startsAt, endsAt, isEnabled: true })]} />,
    );
    expect(screen.getByText("アクティブ")).toBeDefined();
  });

  it("開始前のウィンドウに「予定」バッジを表示する", () => {
    const startsAt = new Date(Date.now() + 3600000).toISOString();
    const endsAt = new Date(Date.now() + 7200000).toISOString();
    render(
      <MaintenancePage initialWindows={[makeWindow({ startsAt, endsAt, isEnabled: true })]} />,
    );
    expect(screen.getByText("予定")).toBeDefined();
  });

  it("終了済みのウィンドウに「終了済み」バッジを表示する", () => {
    const startsAt = new Date(Date.now() - 7200000).toISOString();
    const endsAt = new Date(Date.now() - 3600000).toISOString();
    render(
      <MaintenancePage initialWindows={[makeWindow({ startsAt, endsAt, isEnabled: true })]} />,
    );
    expect(screen.getByText("終了済み")).toBeDefined();
  });

  it("無効なウィンドウに「無効」バッジを表示する", () => {
    render(<MaintenancePage initialWindows={[makeWindow({ isEnabled: false })]} />);
    expect(screen.getByText("無効")).toBeDefined();
  });

  it("新規作成ダイアログを開く", () => {
    render(<MaintenancePage initialWindows={[]} />);
    fireEvent.click(screen.getByText("新規作成"));
    expect(screen.getByText("メンテナンス設定を作成")).toBeDefined();
  });

  it("新規作成フォームのタイトルにデフォルト値が入っている", () => {
    render(<MaintenancePage initialWindows={[]} />);
    fireEvent.click(screen.getByText("新規作成"));
    const titleInput = screen.getByLabelText(/タイトル/) as HTMLInputElement;
    expect(titleInput.value).toBe("システムメンテナンス");
  });

  it("編集ダイアログを開く", () => {
    render(<MaintenancePage initialWindows={[makeWindow()]} />);
    fireEvent.click(screen.getByLabelText("編集"));
    expect(screen.getByText("メンテナンス設定を編集")).toBeDefined();
  });

  it("編集フォームにタイトルとメッセージが事前入力される", () => {
    render(
      <MaintenancePage
        initialWindows={[makeWindow({ title: "編集前タイトル", message: "編集前メッセージ" })]}
      />,
    );
    fireEvent.click(screen.getByLabelText("編集"));

    const titleInput = screen.getByLabelText(/タイトル/) as HTMLInputElement;
    expect(titleInput.value).toBe("編集前タイトル");

    const messageTextarea = screen.getByLabelText(/メッセージ/) as HTMLTextAreaElement;
    expect(messageTextarea.value).toBe("編集前メッセージ");
  });

  it("削除ボタンをクリックすると確認ダイアログを表示する", () => {
    render(<MaintenancePage initialWindows={[makeWindow()]} />);
    fireEvent.click(screen.getByLabelText("削除"));
    expect(screen.getByText("メンテナンス設定を削除")).toBeDefined();
  });

  it("削除確認ダイアログにアイテムのタイトルが表示される", () => {
    render(<MaintenancePage initialWindows={[makeWindow({ title: "削除対象" })]} />);
    fireEvent.click(screen.getByLabelText("削除"));
    expect(screen.getByText(/「削除対象」を削除しますか？/)).toBeDefined();
  });

  it("キャンセルでダイアログが閉じる", () => {
    render(<MaintenancePage initialWindows={[]} />);
    fireEvent.click(screen.getByText("新規作成"));
    expect(screen.getByText("メンテナンス設定を作成")).toBeDefined();
    fireEvent.click(screen.getByText("キャンセル"));
    expect(screen.queryByText("メンテナンス設定を作成")).toBeNull();
  });

  it("複数のメンテナンス設定を表示する", () => {
    render(
      <MaintenancePage
        initialWindows={[
          makeWindow({ id: "win-1", title: "メンテA" }),
          makeWindow({ id: "win-2", title: "メンテB" }),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: /メンテナンス設定 2件/ })).toBeDefined();
    expect(screen.getByText("メンテA")).toBeDefined();
    expect(screen.getByText("メンテB")).toBeDefined();
  });
});

describe("MaintenancePage API interactions", () => {
  it("作成が成功するとダイアログが閉じてリストに追加される", async () => {
    const newItem: MaintenanceItem = makeWindow({ id: "new-win", title: "新しいメンテ" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ maintenanceWindow: newItem }),
      }),
    );

    render(<MaintenancePage initialWindows={[]} />);
    fireEvent.click(screen.getByText("新規作成"));
    fireEvent.submit(screen.getByLabelText(/タイトル/).closest("form")!);

    await waitFor(() => {
      expect(screen.queryByText("メンテナンス設定を作成")).toBeNull();
    });
    expect(screen.getByText("新しいメンテ")).toBeDefined();
  });

  it("編集が成功するとダイアログが閉じてリストが更新される", async () => {
    const original = makeWindow({ id: "win-1", title: "旧タイトル" });
    const updated: MaintenanceItem = { ...original, title: "新タイトル" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ maintenanceWindow: updated }),
      }),
    );

    render(<MaintenancePage initialWindows={[original]} />);
    fireEvent.click(screen.getByLabelText("編集"));
    fireEvent.submit(screen.getByLabelText(/タイトル/).closest("form")!);

    await waitFor(() => {
      expect(screen.queryByText("メンテナンス設定を編集")).toBeNull();
    });
    expect(screen.getByText("新タイトル")).toBeDefined();
    expect(screen.queryByText("旧タイトル")).toBeNull();
  });

  it("削除が確認された後にリストからアイテムが消える", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    render(<MaintenancePage initialWindows={[makeWindow({ title: "削除対象" })]} />);
    fireEvent.click(screen.getByLabelText("削除"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "削除" }),
    );

    await waitFor(() => {
      expect(screen.queryByText("削除対象")).toBeNull();
    });
    expect(screen.getByText("メンテナンス設定がありません。")).toBeDefined();
  });

  it("作成 API エラー時にフォームエラーを表示してダイアログを維持する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "バリデーションエラー" }),
      }),
    );

    render(<MaintenancePage initialWindows={[]} />);
    fireEvent.click(screen.getByText("新規作成"));
    fireEvent.submit(screen.getByLabelText(/タイトル/).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("バリデーションエラー")).toBeDefined();
    });
    expect(screen.getByText("メンテナンス設定を作成")).toBeDefined();
  });

  it("作成時に通信エラーが発生した場合「通信エラーが発生しました」を表示する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    render(<MaintenancePage initialWindows={[]} />);
    fireEvent.click(screen.getByText("新規作成"));
    fireEvent.submit(screen.getByLabelText(/タイトル/).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("通信エラーが発生しました")).toBeDefined();
    });
  });

  it("編集 API エラー時にフォームエラーを表示してダイアログを維持する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "更新に失敗しました" }),
      }),
    );

    render(<MaintenancePage initialWindows={[makeWindow()]} />);
    fireEvent.click(screen.getByLabelText("編集"));
    fireEvent.submit(screen.getByLabelText(/タイトル/).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("更新に失敗しました")).toBeDefined();
    });
    expect(screen.getByText("メンテナンス設定を編集")).toBeDefined();
  });
});
