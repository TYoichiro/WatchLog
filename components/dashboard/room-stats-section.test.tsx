import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ActiveFanSummary, RoomProfile } from "@/lib/showroom";
import { RoomStatsSection, RoomStatsSectionSkeleton } from "./room-stats-section";

const makeProfile = (overrides: Partial<RoomProfile> = {}): RoomProfile => ({
  roomId: 1,
  roomUrlKey: "test_room",
  roomName: "テストルーム",
  roomImageUrl: "",
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

const makeActiveFan = (overrides: Partial<ActiveFanSummary> = {}): ActiveFanSummary => ({
  fanName: "スペシャルファン",
  totalUserCount: "100",
  ...overrides,
});

describe("RoomStatsSectionSkeleton", () => {
  it("6枚のスケルトンカードを表示する", () => {
    const { container } = render(<RoomStatsSectionSkeleton />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });
});

describe("RoomStatsSection", () => {
  it("6枚のスタッツカードを表示する", () => {
    const { container } = render(
      <RoomStatsSection profile={makeProfile()} activeFan={makeActiveFan()} />,
    );
    const cards = container.querySelectorAll("section > *");
    expect(cards.length).toBe(6);
  });

  describe("フォロワー数", () => {
    it("profile がある場合はフォロワー数を表示する", () => {
      render(<RoomStatsSection profile={makeProfile({ followerNum: "5678" })} activeFan={null} />);
      expect(screen.getByText("5678 人")).toBeDefined();
    });

    it("「フォロワー数」ラベルを表示する", () => {
      render(<RoomStatsSection profile={makeProfile()} activeFan={null} />);
      expect(screen.getByText("フォロワー数")).toBeDefined();
    });

    it("profile が null の場合は取得失敗メッセージを表示する", () => {
      render(<RoomStatsSection profile={null} activeFan={null} />);
      expect(screen.getAllByText("取得できませんでした").length).toBeGreaterThan(0);
    });
  });

  describe("アクティブファン", () => {
    it("activeFan がある場合はファン名をラベルとして表示する", () => {
      render(
        <RoomStatsSection
          profile={null}
          activeFan={makeActiveFan({ fanName: "ゴールドファン" })}
        />,
      );
      expect(screen.getByText("ゴールドファン")).toBeDefined();
    });

    it("activeFan がある場合は人数を表示する", () => {
      render(
        <RoomStatsSection
          profile={null}
          activeFan={makeActiveFan({ totalUserCount: "250" })}
        />,
      );
      expect(screen.getByText("250 人")).toBeDefined();
    });

    it("activeFan が null の場合はデフォルトラベル「アクティブファン」を表示する", () => {
      render(<RoomStatsSection profile={null} activeFan={null} />);
      expect(screen.getByText("アクティブファン")).toBeDefined();
    });
  });

  describe("ルームレベル", () => {
    it("profile がある場合はルームレベルを表示する", () => {
      render(<RoomStatsSection profile={makeProfile({ roomLevel: "25" })} activeFan={null} />);
      expect(screen.getByText("25 Lv")).toBeDefined();
    });

    it("「ルームレベル」ラベルを表示する", () => {
      render(<RoomStatsSection profile={makeProfile()} activeFan={null} />);
      expect(screen.getByText("ルームレベル")).toBeDefined();
    });
  });

  describe("次回配信予定", () => {
    it("currentLiveStartedAt が null の場合は「未定」を表示する", () => {
      render(
        <RoomStatsSection
          profile={makeProfile({ currentLiveStartedAt: null })}
          activeFan={null}
        />,
      );
      expect(screen.getByText("未定")).toBeDefined();
    });

    it("currentLiveStartedAt が設定されている場合は「未定」を表示しない", () => {
      render(
        <RoomStatsSection
          profile={makeProfile({ currentLiveStartedAt: 1700000000 })}
          activeFan={null}
        />,
      );
      expect(screen.queryByText("未定")).toBeNull();
    });

    it("「次回配信予定」ラベルを表示する", () => {
      render(<RoomStatsSection profile={makeProfile()} activeFan={null} />);
      expect(screen.getByText("次回配信予定")).toBeDefined();
    });
  });

  describe("SHOWランク", () => {
    it("showRankTimeCharge が null の場合はランク記号のみ表示する", () => {
      render(
        <RoomStatsSection
          profile={makeProfile({ showRankSubdivided: "B", showRankTimeCharge: null })}
          activeFan={null}
        />,
      );
      expect(screen.getByText("B")).toBeDefined();
      expect(screen.queryByText(/1時間/)).toBeNull();
    });

    it("showRankTimeCharge がある場合は括弧付きで時間料金を表示する", () => {
      render(
        <RoomStatsSection
          profile={makeProfile({ showRankSubdivided: "A", showRankTimeCharge: "50pt" })}
          activeFan={null}
        />,
      );
      expect(screen.getByText("A（50pt/1時間）")).toBeDefined();
    });

    it("「SHOWランク」ラベルを表示する", () => {
      render(<RoomStatsSection profile={makeProfile()} activeFan={null} />);
      expect(screen.getByText("SHOWランク")).toBeDefined();
    });
  });

  describe("ジャンル", () => {
    it("profile がある場合はジャンル名を表示する", () => {
      render(<RoomStatsSection profile={makeProfile({ genreName: "ゲーム" })} activeFan={null} />);
      expect(screen.getByText("ゲーム")).toBeDefined();
    });

    it("「ジャンル」ラベルを表示する", () => {
      render(<RoomStatsSection profile={makeProfile()} activeFan={null} />);
      expect(screen.getByText("ジャンル")).toBeDefined();
    });
  });
});
