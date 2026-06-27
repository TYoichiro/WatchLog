import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AppNotice } from "@/lib/dashboard-notices";
import {
  NoticeListCard,
  NoticeListLoadingCard,
} from "./notice-list-card";

const makeNotice = (overrides: Partial<AppNotice> = {}): AppNotice => ({
  id: 1,
  title: "テストお知らせ",
  body: "テスト本文",
  date: "2024/01/01 10:00",
  linkUrl: null,
  ...overrides,
});

describe("NoticeListLoadingCard", () => {
  it("「読み込み中」バッジを表示する", () => {
    render(<NoticeListLoadingCard />);
    expect(screen.getByText("読み込み中")).toBeDefined();
  });

  it("「お知らせ」見出しを表示する", () => {
    render(<NoticeListLoadingCard />);
    expect(screen.getByText("お知らせ")).toBeDefined();
  });

  it("スケルトンのアニメーション要素を表示する", () => {
    const { container } = render(<NoticeListLoadingCard />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("NoticeListCard", () => {
  describe("バッジとカウント表示", () => {
    it("お知らせ件数をバッジに表示する", () => {
      render(<NoticeListCard notices={[makeNotice()]} />);
      expect(screen.getByText("1件")).toBeDefined();
    });

    it("お知らせがない場合は 0件 を表示する", () => {
      render(<NoticeListCard notices={[]} />);
      expect(screen.getByText("0件")).toBeDefined();
    });

    it("複数件の場合は正しい件数を表示する", () => {
      render(
        <NoticeListCard
          notices={[makeNotice({ id: 1 }), makeNotice({ id: 2 }), makeNotice({ id: 3 })]}
        />,
      );
      expect(screen.getByText("3件")).toBeDefined();
    });

    it("hasError が true の場合は「取得失敗」バッジを表示する", () => {
      render(<NoticeListCard notices={[]} hasError />);
      expect(screen.getByText("取得失敗")).toBeDefined();
    });
  });

  describe("エラー状態", () => {
    it("hasError が true の場合はエラー見出しを表示する", () => {
      render(<NoticeListCard notices={[]} hasError />);
      expect(screen.getByText("お知らせを取得できませんでした")).toBeDefined();
    });

    it("hasError が true の場合は再試行メッセージを表示する", () => {
      render(<NoticeListCard notices={[]} hasError />);
      expect(screen.getByText("時間をおいて再読み込みしてください。")).toBeDefined();
    });

    it("hasError が true の場合はお知らせ項目のタイトルを表示しない", () => {
      render(<NoticeListCard notices={[makeNotice({ title: "表示されないタイトル" })]} hasError />);
      expect(screen.queryByText(/表示されないタイトル/)).toBeNull();
    });
  });

  describe("空状態", () => {
    it("お知らせがない場合は空状態メッセージを表示する", () => {
      render(<NoticeListCard notices={[]} />);
      expect(screen.getByText("公開中のお知らせはありません。")).toBeDefined();
    });
  });

  describe("お知らせアイテム", () => {
    it("番号付きでタイトルを表示する", () => {
      render(<NoticeListCard notices={[makeNotice({ title: "テストお知らせ" })]} />);
      expect(screen.getByRole("heading", { level: 3, name: "1. テストお知らせ" })).toBeDefined();
    });

    it("本文を表示する", () => {
      render(<NoticeListCard notices={[makeNotice({ body: "本文テキスト" })]} />);
      expect(screen.getByText("本文テキスト")).toBeDefined();
    });

    it("日付を表示する", () => {
      render(<NoticeListCard notices={[makeNotice({ date: "2024/01/15 12:00" })]} />);
      expect(screen.getByText("2024/01/15 12:00")).toBeDefined();
    });

    it("複数のお知らせを連番で表示する", () => {
      render(
        <NoticeListCard
          notices={[
            makeNotice({ id: 1, title: "お知らせA" }),
            makeNotice({ id: 2, title: "お知らせB" }),
          ]}
        />,
      );
      expect(screen.getByRole("heading", { level: 3, name: "1. お知らせA" })).toBeDefined();
      expect(screen.getByRole("heading", { level: 3, name: "2. お知らせB" })).toBeDefined();
    });
  });

  describe("linkUrl", () => {
    it("linkUrl が設定されている場合は「こちら」リンクを表示する", () => {
      render(
        <NoticeListCard notices={[makeNotice({ linkUrl: "https://example.com" })]} />,
      );
      const link = screen.getByRole("link", { name: "こちら" });
      expect(link).toBeDefined();
      expect(link.getAttribute("href")).toBe("https://example.com");
    });

    it("linkUrl が null の場合はリンクを表示しない", () => {
      render(<NoticeListCard notices={[makeNotice({ linkUrl: null })]} />);
      expect(screen.queryByRole("link")).toBeNull();
    });

    it("リンクは新しいタブで開く", () => {
      render(
        <NoticeListCard notices={[makeNotice({ linkUrl: "https://example.com" })]} />,
      );
      const link = screen.getByRole("link");
      expect(link.getAttribute("target")).toBe("_blank");
    });

    it("リンクに rel=noopener noreferrer が設定されている", () => {
      render(
        <NoticeListCard notices={[makeNotice({ linkUrl: "https://example.com" })]} />,
      );
      const link = screen.getByRole("link");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    });
  });
});
