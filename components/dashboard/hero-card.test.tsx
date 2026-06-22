import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RoomProfile } from "@/lib/showroom";
import { HeroCard, HeroCardSkeleton } from "./hero-card";

const makeProfile = (overrides: Partial<RoomProfile> = {}): RoomProfile => ({
  roomId: 1,
  roomUrlKey: "test_room",
  roomName: "テストルーム",
  roomImageUrl: "https://example.com/image.jpg",
  isOnlive: false,
  premiumRoomType: 0,
  followerNum: "1234",
  viewNum: null,
  genreName: "音楽",
  isOfficial: false,
  roomLevel: "10",
  leagueLabel: "",
  showRankSubdivided: "A",
  showRankTimeCharge: null,
  nextShowRankSubdivided: "S",
  currentLiveStartedAt: null,
  ...overrides,
});

describe("HeroCardSkeleton", () => {
  it("スケルトン要素を表示する", () => {
    const { container } = render(<HeroCardSkeleton />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeDefined();
  });
});

describe("HeroCard", () => {
  describe("profile が null の場合", () => {
    it("デフォルトメッセージを表示する", () => {
      render(<HeroCard profile={null} />);
      expect(screen.getByText("ルーム情報を取得できませんでした")).toBeDefined();
    });

    it("「フリー枠ルーム」バッジを表示する", () => {
      render(<HeroCard profile={null} />);
      expect(screen.getByText("フリー枠ルーム")).toBeDefined();
    });

    it("画像を表示しない", () => {
      const { container } = render(<HeroCard profile={null} />);
      expect(container.querySelector("img")).toBeNull();
    });
  });

  describe("profile が設定されている場合", () => {
    it("ルーム名を表示する", () => {
      render(<HeroCard profile={makeProfile({ roomName: "サンプルルーム" })} />);
      expect(screen.getByText("サンプルルーム")).toBeDefined();
    });

    it("isOfficial が true の場合は「公式枠ルーム」バッジを表示する", () => {
      render(<HeroCard profile={makeProfile({ isOfficial: true })} />);
      expect(screen.getByText("公式枠ルーム")).toBeDefined();
    });

    it("isOfficial が false の場合は「フリー枠ルーム」バッジを表示する", () => {
      render(<HeroCard profile={makeProfile({ isOfficial: false })} />);
      expect(screen.getByText("フリー枠ルーム")).toBeDefined();
    });

    it("roomImageUrl がある場合は画像を表示する", () => {
      render(<HeroCard profile={makeProfile({ roomImageUrl: "https://example.com/img.jpg" })} />);
      const img = screen.getByRole("img");
      expect(img).toBeDefined();
      expect(img.getAttribute("src")).toBe("https://example.com/img.jpg");
    });

    it("roomImageUrl が空の場合は画像を表示しない", () => {
      const { container } = render(<HeroCard profile={makeProfile({ roomImageUrl: "" })} />);
      expect(container.querySelector("img")).toBeNull();
    });

    it("画像の alt テキストにルーム名を設定する", () => {
      render(
        <HeroCard
          profile={makeProfile({
            roomName: "テストルーム",
            roomImageUrl: "https://example.com/img.jpg",
          })}
        />,
      );
      expect(screen.getByAltText("テストルーム")).toBeDefined();
    });
  });
});
