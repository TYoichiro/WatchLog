import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoticesPage, type NoticeItem } from "./notices-page";

const makeNotice = (overrides: Partial<NoticeItem> = {}): NoticeItem => ({
  id: 1,
  title: "テストお知らせ",
  content: "テスト本文です",
  displayTarget: "AUTHENTICATED",
  publishedAt: "2024-01-01T10:00:00.000+09:00",
  expiresAt: null,
  linkUrl: null,
  createdAt: "2024-01-01T00:00:00.000+09:00",
  updatedAt: "2024-01-01T00:00:00.000+09:00",
  ...overrides,
});

describe("NoticesPage", () => {
  it("shows empty state when no notices", () => {
    render(<NoticesPage initialNotices={[]} />);
    expect(screen.getByText("お知らせがありません。")).toBeDefined();
  });

  it("shows notice count in heading", () => {
    render(<NoticesPage initialNotices={[makeNotice()]} />);
    expect(screen.getByText("1件")).toBeDefined();
  });

  it("shows 0件 when empty", () => {
    render(<NoticesPage initialNotices={[]} />);
    expect(screen.getByText("0件")).toBeDefined();
  });

  it("renders notice title in list", () => {
    render(<NoticesPage initialNotices={[makeNotice()]} />);
    expect(screen.getByText("テストお知らせ")).toBeDefined();
  });

  it("renders notice content in list", () => {
    render(<NoticesPage initialNotices={[makeNotice()]} />);
    expect(screen.getByText("テスト本文です")).toBeDefined();
  });

  it("shows 新規作成 button", () => {
    render(<NoticesPage initialNotices={[]} />);
    expect(screen.getByText("新規作成")).toBeDefined();
  });

  it("shows edit buttons for each notice", () => {
    render(<NoticesPage initialNotices={[makeNotice()]} />);
    expect(screen.getByLabelText("編集")).toBeDefined();
  });

  it("shows delete buttons for each notice", () => {
    render(<NoticesPage initialNotices={[makeNotice()]} />);
    expect(screen.getByLabelText("削除")).toBeDefined();
  });

  it("opens create dialog when 新規作成 is clicked", () => {
    render(<NoticesPage initialNotices={[]} />);
    fireEvent.click(screen.getByText("新規作成"));
    expect(screen.getByText("お知らせを作成")).toBeDefined();
  });

  it("opens edit dialog when edit button is clicked", () => {
    render(<NoticesPage initialNotices={[makeNotice()]} />);
    fireEvent.click(screen.getByLabelText("編集"));
    expect(screen.getByText("お知らせを編集")).toBeDefined();
  });

  it("pre-fills form with notice data when editing", () => {
    render(
      <NoticesPage initialNotices={[makeNotice({ title: "編集前タイトル" })]} />,
    );
    fireEvent.click(screen.getByLabelText("編集"));
    const titleInput = screen.getByLabelText(/タイトル/) as HTMLInputElement;
    expect(titleInput.value).toBe("編集前タイトル");
  });

  it("shows delete confirmation dialog when delete button is clicked", () => {
    render(<NoticesPage initialNotices={[makeNotice()]} />);
    fireEvent.click(screen.getByLabelText("削除"));
    expect(screen.getByText("お知らせを削除")).toBeDefined();
  });

  it("shows AUTHENTICATED display target badge", () => {
    render(
      <NoticesPage
        initialNotices={[makeNotice({ displayTarget: "AUTHENTICATED" })]}
      />,
    );
    expect(screen.getByText("ログイン後")).toBeDefined();
  });

  it("shows LOGIN display target badge", () => {
    render(
      <NoticesPage
        initialNotices={[makeNotice({ displayTarget: "LOGIN" })]}
      />,
    );
    expect(screen.getByText("ログイン画面")).toBeDefined();
  });

  it("shows ALL display target badge", () => {
    render(
      <NoticesPage initialNotices={[makeNotice({ displayTarget: "ALL" })]} />,
    );
    expect(screen.getByText("全員")).toBeDefined();
  });

  it("shows 公開予定 status for future notice", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    render(
      <NoticesPage initialNotices={[makeNotice({ publishedAt: futureDate })]} />,
    );
    expect(screen.getByText("公開予定")).toBeDefined();
  });

  it("shows 期限切れ status for expired notice", () => {
    const pastPublished = new Date(Date.now() - 86400000 * 2).toISOString();
    const pastExpires = new Date(Date.now() - 86400000).toISOString();
    render(
      <NoticesPage
        initialNotices={[
          makeNotice({ publishedAt: pastPublished, expiresAt: pastExpires }),
        ]}
      />,
    );
    expect(screen.getByText("期限切れ")).toBeDefined();
  });

  it("shows 公開中 status for currently published notice", () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    render(
      <NoticesPage
        initialNotices={[makeNotice({ publishedAt: pastDate })]}
      />,
    );
    expect(screen.getByText("公開中")).toBeDefined();
  });

  it("renders multiple notices", () => {
    const notices = [
      makeNotice({ id: 1, title: "お知らせ1" }),
      makeNotice({ id: 2, title: "お知らせ2" }),
      makeNotice({ id: 3, title: "お知らせ3" }),
    ];
    render(<NoticesPage initialNotices={notices} />);
    expect(screen.getByText("3件")).toBeDefined();
    expect(screen.getByText("お知らせ1")).toBeDefined();
    expect(screen.getByText("お知らせ2")).toBeDefined();
    expect(screen.getByText("お知らせ3")).toBeDefined();
  });

  it("closes dialog when キャンセル is clicked", () => {
    render(<NoticesPage initialNotices={[]} />);
    fireEvent.click(screen.getByText("新規作成"));
    expect(screen.getByText("お知らせを作成")).toBeDefined();
    fireEvent.click(screen.getByText("キャンセル"));
    expect(screen.queryByText("お知らせを作成")).toBeNull();
  });
});
