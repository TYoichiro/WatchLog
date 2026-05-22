import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogListPage, type LogListItem } from "./log-list-page";

const { routerPush, routerRefresh } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    refresh: routerRefresh,
  }),
}));

vi.mock("@/lib/onlive-local-log", () => ({
  readOnliveLocalLog: vi.fn().mockReturnValue(null),
  deleteOnliveLocalLog: vi.fn(),
  writeJsonViewerLog: vi.fn(),
  isValidJsonViewerLog: vi.fn().mockReturnValue(false),
}));

const makeLog = (overrides: Partial<LogListItem> = {}): LogListItem => ({
  id: "log-1",
  capturedAt: "2026-01-01T10:00:00.000+09:00",
  commentCount: 10,
  createdAt: "2026-01-01T10:00:00.000+09:00",
  giftCount: 5,
  liveId: "live-1",
  liveRankingCount: 3,
  roomId: "room-1",
  roomName: "テストルーム",
  totalRankingCount: 2,
  updatedAt: "2026-01-01T10:00:00.000+09:00",
  ...overrides,
});

function makeLogs(count: number): LogListItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeLog({ id: `log-${i + 1}`, liveId: `live-${i + 1}` })
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  routerPush.mockReset();
  routerRefresh.mockReset();
});

describe("LogListPage", () => {
  describe("基本表示", () => {
    it("ログが0件の場合、空状態メッセージを表示する", () => {
      render(<LogListPage initialLogs={[]} />);
      expect(
        screen.getByText(
          "保存済みログはまだありません。配信終了時にログが保存されます。"
        )
      ).toBeDefined();
    });

    it("ログ件数を見出しに表示する", () => {
      render(<LogListPage initialLogs={makeLogs(3)} />);
      expect(screen.getByText("3件")).toBeDefined();
    });

    it("ログが0件の場合、表示件数セレクトを表示しない", () => {
      render(<LogListPage initialLogs={[]} />);
      expect(screen.queryByLabelText("表示件数")).toBeNull();
    });

    it("ログがある場合、表示件数セレクトを表示する", () => {
      render(<LogListPage initialLogs={[makeLog()]} />);
      expect(screen.getByLabelText("表示件数")).toBeDefined();
    });

    it("表示件数セレクトのデフォルト値は20件", () => {
      render(<LogListPage initialLogs={[makeLog()]} />);
      const select = screen.getByLabelText("表示件数") as HTMLSelectElement;
      expect(select.value).toBe("20");
    });

    it("表示件数セレクトに20・50・100件の選択肢がある", () => {
      render(<LogListPage initialLogs={[makeLog()]} />);
      expect(screen.getByRole("option", { name: "20件" })).toBeDefined();
      expect(screen.getByRole("option", { name: "50件" })).toBeDefined();
      expect(screen.getByRole("option", { name: "100件" })).toBeDefined();
    });
  });

  describe("ページネーション - 表示制御", () => {
    it("ログが20件以下の場合、ページネーションコントロールを表示しない", () => {
      render(<LogListPage initialLogs={makeLogs(20)} />);
      expect(screen.queryByRole("button", { name: "前のページ" })).toBeNull();
      expect(screen.queryByRole("button", { name: "次のページ" })).toBeNull();
    });

    it("ログが21件以上の場合、ページネーションコントロールを表示する", () => {
      render(<LogListPage initialLogs={makeLogs(21)} />);
      expect(screen.getByRole("button", { name: "前のページ" })).toBeDefined();
      expect(screen.getByRole("button", { name: "次のページ" })).toBeDefined();
    });

    it("デフォルトで最初の20件のみを表示する", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      expect(screen.getByText("Live ID: live-20")).toBeDefined();
      expect(screen.queryByText("Live ID: live-21")).toBeNull();
    });

    it("最初のページでは「前のページ」ボタンが無効になる", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      const prevBtn = screen.getByRole("button", {
        name: "前のページ",
      }) as HTMLButtonElement;
      expect(prevBtn.disabled).toBe(true);
    });

    it("2ページ以上ある場合「次のページ」ボタンが有効になる", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      const nextBtn = screen.getByRole("button", {
        name: "次のページ",
      }) as HTMLButtonElement;
      expect(nextBtn.disabled).toBe(false);
    });
  });

  describe("ページネーション - ページ移動", () => {
    it("「次のページ」ボタンをクリックすると2ページ目に移動する", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
      expect(screen.queryByText("Live ID: live-1")).toBeNull();
      expect(screen.getByText("Live ID: live-21")).toBeDefined();
    });

    it("2ページ目では「前のページ」ボタンが有効になる", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
      const prevBtn = screen.getByRole("button", {
        name: "前のページ",
      }) as HTMLButtonElement;
      expect(prevBtn.disabled).toBe(false);
    });

    it("最後のページでは「次のページ」ボタンが無効になる", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
      const nextBtn = screen.getByRole("button", {
        name: "次のページ",
      }) as HTMLButtonElement;
      expect(nextBtn.disabled).toBe(true);
    });

    it("「前のページ」ボタンをクリックすると1ページ目に戻る", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
      fireEvent.click(screen.getByRole("button", { name: "前のページ" }));
      expect(screen.getByText("Live ID: live-1")).toBeDefined();
      expect(screen.queryByText("Live ID: live-21")).toBeNull();
    });

    it("ページ番号ボタンをクリックすると該当ページに移動する", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      fireEvent.click(screen.getByRole("button", { name: "2" }));
      expect(screen.queryByText("Live ID: live-1")).toBeNull();
      expect(screen.getByText("Live ID: live-21")).toBeDefined();
    });
  });

  describe("ページネーション - 表示件数変更", () => {
    it("表示件数を50件に変更するとページ1にリセットされる", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
      expect(screen.getByText("Live ID: live-21")).toBeDefined();

      fireEvent.change(screen.getByLabelText("表示件数"), {
        target: { value: "50" },
      });
      expect(screen.getByText("Live ID: live-1")).toBeDefined();
    });

    it("表示件数を100件に変更するとページネーションコントロールが非表示になる", () => {
      render(<LogListPage initialLogs={makeLogs(25)} />);
      fireEvent.change(screen.getByLabelText("表示件数"), {
        target: { value: "100" },
      });
      expect(screen.queryByRole("button", { name: "前のページ" })).toBeNull();
      expect(screen.queryByRole("button", { name: "次のページ" })).toBeNull();
    });

    it("表示件数を50件に変更すると50件目まで表示する", () => {
      render(<LogListPage initialLogs={makeLogs(60)} />);
      fireEvent.change(screen.getByLabelText("表示件数"), {
        target: { value: "50" },
      });
      expect(screen.getByText("Live ID: live-50")).toBeDefined();
      expect(screen.queryByText("Live ID: live-51")).toBeNull();
    });
  });

  describe("ページネーション - ページ番号の表示", () => {
    it("ページ数が7以下の場合、全ページ番号を表示する", () => {
      render(<LogListPage initialLogs={makeLogs(140)} />);
      for (let i = 1; i <= 7; i++) {
        expect(
          screen.getByRole("button", { name: String(i) })
        ).toBeDefined();
      }
    });

    it("ページ数が8以上の場合、省略記号を表示する", () => {
      render(<LogListPage initialLogs={makeLogs(160)} />);
      expect(screen.getAllByText("...").length).toBeGreaterThan(0);
    });
  });

  describe("削除後のページ自動調整", () => {
    it("最終ページのログを削除するとページが自動的に1ページ目に調整される", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
      );

      render(<LogListPage initialLogs={makeLogs(21)} />);
      fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
      expect(screen.getByText("Live ID: live-21")).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "削除" }));
      fireEvent.click(await screen.findByRole("button", { name: "はい" }));

      expect(await screen.findByText("Live ID: live-1")).toBeDefined();
      expect(screen.queryByText("Live ID: live-21")).toBeNull();
    });
  });
});
