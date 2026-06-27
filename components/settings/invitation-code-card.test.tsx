import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvitationCodeCard } from "./invitation-code-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InvitationCodeCard", () => {
  describe("見出し", () => {
    it("渡した heading を表示する", () => {
      render(
        <InvitationCodeCard
          invitationCodes={[]}
          isAdmin={false}
          heading="招待コード一覧"
        />,
      );
      expect(
        screen.getByRole("heading", { level: 2, name: "招待コード一覧" }),
      ).toBeDefined();
    });
  });

  describe("空の状態", () => {
    it("招待コードがない場合は空状態メッセージを表示する", () => {
      render(
        <InvitationCodeCard
          invitationCodes={[]}
          isAdmin={false}
          heading="招待コード"
        />,
      );
      expect(screen.getByText("招待コードはありません")).toBeDefined();
    });

    it("招待コードがない場合はコードリストを表示しない", () => {
      render(
        <InvitationCodeCard
          invitationCodes={[]}
          isAdmin={false}
          heading="招待コード"
        />,
      );
      expect(screen.queryByRole("list")).toBeNull();
    });
  });

  describe("コード一覧", () => {
    it("招待コードを表示する", () => {
      render(
        <InvitationCodeCard
          invitationCodes={[{ code: "ABCD123456", isActive: true }]}
          isAdmin={false}
          heading="招待コード"
        />,
      );
      expect(screen.getByText("ABCD123456")).toBeDefined();
    });

    it("有効なコードに「有効」バッジを表示する", () => {
      render(
        <InvitationCodeCard
          invitationCodes={[{ code: "ABCD123456", isActive: true }]}
          isAdmin={false}
          heading="招待コード"
        />,
      );
      expect(screen.getByText("有効")).toBeDefined();
    });

    it("無効なコードに「無効」バッジを表示する", () => {
      render(
        <InvitationCodeCard
          invitationCodes={[{ code: "XXXXXX0000", isActive: false }]}
          isAdmin={false}
          heading="招待コード"
        />,
      );
      expect(screen.getByText("無効")).toBeDefined();
    });

    it("複数のコードをすべて表示する", () => {
      render(
        <InvitationCodeCard
          invitationCodes={[
            { code: "CODE111111", isActive: true },
            { code: "CODE222222", isActive: false },
          ]}
          isAdmin={false}
          heading="招待コード"
        />,
      );
      expect(screen.getByText("CODE111111")).toBeDefined();
      expect(screen.getByText("CODE222222")).toBeDefined();
      expect(screen.getByText("有効")).toBeDefined();
      expect(screen.getByText("無効")).toBeDefined();
    });
  });

  describe("管理者権限", () => {
    it("isAdmin=true のとき「招待コード生成」ボタンを表示する", () => {
      render(
        <InvitationCodeCard
          invitationCodes={[]}
          isAdmin={true}
          heading="招待コード"
        />,
      );
      expect(
        screen.getByRole("button", { name: /招待コード生成/ }),
      ).toBeDefined();
    });

    it("isAdmin=false のとき「招待コード生成」ボタンを表示しない", () => {
      render(
        <InvitationCodeCard
          invitationCodes={[]}
          isAdmin={false}
          heading="招待コード"
        />,
      );
      expect(
        screen.queryByRole("button", { name: /招待コード生成/ }),
      ).toBeNull();
    });
  });
});
