import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OnliveItem } from "@/lib/showroom";
import { ShowTubeLivePage } from "./showtube-live-page";

function makeItem(overrides: Partial<OnliveItem> = {}): OnliveItem {
  return {
    roomId: 12345,
    roomUrlKey: "test-room",
    mainName: "テストルーム",
    image: "https://example.com/image.jpg",
    imageSquare: null,
    viewNum: 100,
    followerNum: 500,
    startedAt: 1700000000,
    liveId: 1,
    genreId: 1,
    genreName: "アイドル",
    badgeList: [],
    streamingUrlList: [],
    telop: null,
    liverThemeTitle: "",
    everydayLiveLabel: null,
    genreRankingRank: 0,
    isKaraoke: false,
    premiumRoomType: 0,
    frameImageUrl: null,
    ...overrides,
  };
}

describe("ShowTubeLivePage", () => {
  describe("エラー状態", () => {
    it("hasError=true のときエラーメッセージを表示する", () => {
      render(<ShowTubeLivePage items={[]} hasError={true} />);
      expect(screen.getByText("データの取得に失敗しました。")).toBeTruthy();
    });

    it("hasError=true のとき items は表示されない", () => {
      render(
        <ShowTubeLivePage
          items={[makeItem({ mainName: "ルームA" })]}
          hasError={true}
        />,
      );
      expect(screen.queryByText("ルームA")).toBeNull();
    });
  });

  describe("空のリスト", () => {
    it("items が空のとき空メッセージを表示する", () => {
      render(<ShowTubeLivePage items={[]} hasError={false} />);
      expect(screen.getByText("ライブ中のルームはありません。")).toBeTruthy();
    });
  });

  describe("一覧表示", () => {
    it("アイテムの mainName を表示する", () => {
      render(
        <ShowTubeLivePage
          items={[makeItem({ mainName: "テストルーム" })]}
          hasError={false}
        />,
      );
      expect(screen.getByText("テストルーム")).toBeTruthy();
    });

    it("アイテムの roomId を表示する", () => {
      render(
        <ShowTubeLivePage
          items={[makeItem({ roomId: 12345 })]}
          hasError={false}
        />,
      );
      expect(screen.getByText("12345")).toBeTruthy();
    });

    it("カードリンクが正しい href を持つ", () => {
      render(
        <ShowTubeLivePage
          items={[makeItem({ roomId: 99999 })]}
          hasError={false}
        />,
      );
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/showtube/watch?room_id=99999");
    });

    it("複数アイテムをすべて表示する", () => {
      const items = [
        makeItem({ roomId: 1, mainName: "ルームA" }),
        makeItem({ roomId: 2, mainName: "ルームB" }),
        makeItem({ roomId: 3, mainName: "ルームC" }),
      ];
      render(<ShowTubeLivePage items={items} hasError={false} />);
      expect(screen.getByText("ルームA")).toBeTruthy();
      expect(screen.getByText("ルームB")).toBeTruthy();
      expect(screen.getByText("ルームC")).toBeTruthy();
    });

    it("複数アイテムのリンク href がそれぞれ正しい", () => {
      const items = [makeItem({ roomId: 111 }), makeItem({ roomId: 222 })];
      render(<ShowTubeLivePage items={items} hasError={false} />);
      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));
      expect(hrefs).toContain("/showtube/watch?room_id=111");
      expect(hrefs).toContain("/showtube/watch?room_id=222");
    });

    it("カード画像の src が item.image になる", () => {
      render(
        <ShowTubeLivePage
          items={[makeItem({ image: "https://example.com/thumb.jpg" })]}
          hasError={false}
        />,
      );
      const img = screen.getByRole("img");
      expect(img.getAttribute("src")).toBe("https://example.com/thumb.jpg");
    });

    it("カード画像の alt が item.mainName になる", () => {
      render(
        <ShowTubeLivePage
          items={[makeItem({ mainName: "テストルーム名" })]}
          hasError={false}
        />,
      );
      const img = screen.getByRole("img");
      expect(img.getAttribute("alt")).toBe("テストルーム名");
    });
  });
});
