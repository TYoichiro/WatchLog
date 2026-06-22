import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EventAndSupportSummary } from "@/lib/showroom";
import { EventOverviewCard, EventOverviewCardSkeleton } from "./event-overview-card";

const makeEventAndSupport = (
  overrides: Partial<EventAndSupportSummary> = {},
): EventAndSupportSummary => ({
  event: {
    id: 1,
    name: "テストイベント",
    imageUrl: "https://example.com/event.jpg",
    startAt: 1700000000,
    endAt: 1700100000,
    eventUrl: "https://example.com/event",
  },
  support: null,
  ranking: {
    rank: 3,
    beforeRank: 4,
    point: "500",
    gap: "100",
  },
  ...overrides,
});

describe("EventOverviewCardSkeleton", () => {
  it("スケルトン要素を表示する", () => {
    const { container } = render(<EventOverviewCardSkeleton />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeDefined();
  });
});

describe("EventOverviewCard", () => {
  describe("表示しない場合", () => {
    it("eventAndSupport が null の場合は何も表示しない", () => {
      const { container } = render(<EventOverviewCard eventAndSupport={null} />);
      expect(container.firstChild).toBeNull();
    });

    it("event も support も null の場合は何も表示しない", () => {
      const { container } = render(
        <EventOverviewCard eventAndSupport={{ event: null, support: null, ranking: null }} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("イベント表示", () => {
    it("event がある場合は「開催中のイベント」タイトルを表示する", () => {
      render(<EventOverviewCard eventAndSupport={makeEventAndSupport()} />);
      expect(screen.getByText("開催中のイベント")).toBeDefined();
    });

    it("event がある場合は「参加中」バッジを表示する", () => {
      render(<EventOverviewCard eventAndSupport={makeEventAndSupport()} />);
      expect(screen.getByText("参加中")).toBeDefined();
    });

    it("event 名を表示する", () => {
      render(
        <EventOverviewCard
          eventAndSupport={makeEventAndSupport({
            event: {
              id: 1,
              name: "春のイベント",
              imageUrl: "",
              startAt: 0,
              endAt: 0,
              eventUrl: "",
            },
          })}
        />,
      );
      expect(screen.getByText("春のイベント")).toBeDefined();
    });

    it("imageUrl がある場合は画像を表示する", () => {
      render(<EventOverviewCard eventAndSupport={makeEventAndSupport()} />);
      expect(screen.getByRole("img")).toBeDefined();
    });

    it("eventUrl がある場合は画像リンクを設定する", () => {
      render(<EventOverviewCard eventAndSupport={makeEventAndSupport()} />);
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("https://example.com/event");
    });

    it("eventUrl がある場合はリンクが新しいタブで開く", () => {
      render(<EventOverviewCard eventAndSupport={makeEventAndSupport()} />);
      const link = screen.getByRole("link");
      expect(link.getAttribute("target")).toBe("_blank");
    });

    it("eventUrl が空の場合はリンクを表示しない", () => {
      render(
        <EventOverviewCard
          eventAndSupport={makeEventAndSupport({
            event: {
              id: 1,
              name: "テストイベント",
              imageUrl: "https://example.com/event.jpg",
              startAt: 1700000000,
              endAt: 1700100000,
              eventUrl: "",
            },
          })}
        />,
      );
      expect(screen.queryByRole("link")).toBeNull();
    });

    it("「開始日時」ラベルを表示する", () => {
      render(<EventOverviewCard eventAndSupport={makeEventAndSupport()} />);
      expect(screen.getByText("開始日時")).toBeDefined();
    });

    it("「終了日時」ラベルを表示する", () => {
      render(<EventOverviewCard eventAndSupport={makeEventAndSupport()} />);
      expect(screen.getByText("終了日時")).toBeDefined();
    });
  });

  describe("サポート表示", () => {
    it("support のみの場合は「サポート中」タイトルを表示する", () => {
      render(
        <EventOverviewCard
          eventAndSupport={{ event: null, support: { id: 1, name: "テストサポート" }, ranking: null }}
        />,
      );
      expect(screen.getByText("サポート中")).toBeDefined();
    });

    it("support のみの場合は「参加中」バッジを表示しない", () => {
      render(
        <EventOverviewCard
          eventAndSupport={{ event: null, support: { id: 1, name: "テストサポート" }, ranking: null }}
        />,
      );
      expect(screen.queryByText("参加中")).toBeNull();
    });

    it("support 名を表示する", () => {
      render(
        <EventOverviewCard
          eventAndSupport={{
            event: null,
            support: { id: 1, name: "サポートキャンペーン" },
            ranking: null,
          }}
        />,
      );
      expect(screen.getByText("サポートキャンペーン")).toBeDefined();
    });
  });

  describe("ランキング情報", () => {
    it("ランキングがある場合は順位を表示する", () => {
      render(
        <EventOverviewCard
          eventAndSupport={makeEventAndSupport({
            ranking: { rank: 5, beforeRank: 6, point: "300", gap: "50" },
          })}
        />,
      );
      expect(screen.getByText("5 位")).toBeDefined();
    });

    it("1位の場合は「2位との差」を表示する", () => {
      render(
        <EventOverviewCard
          eventAndSupport={makeEventAndSupport({
            ranking: { rank: 1, beforeRank: 1, point: "1000", gap: "200" },
          })}
        />,
      );
      expect(screen.getByText("1000 pt（2位との差 200 pt）")).toBeDefined();
    });

    it("2位以下の場合は「次順位まで」を表示する", () => {
      render(
        <EventOverviewCard
          eventAndSupport={makeEventAndSupport({
            ranking: { rank: 3, beforeRank: 4, point: "500", gap: "100" },
          })}
        />,
      );
      expect(screen.getByText("500 pt（次順位まで 100 pt）")).toBeDefined();
    });

    it("ランキングがない場合は「順位情報はありません」を表示する", () => {
      render(<EventOverviewCard eventAndSupport={makeEventAndSupport({ ranking: null })} />);
      expect(screen.getByText("順位情報はありません")).toBeDefined();
    });

    it("ランキングがない場合は「ポイント情報はありません」を表示する", () => {
      render(<EventOverviewCard eventAndSupport={makeEventAndSupport({ ranking: null })} />);
      expect(screen.getByText("ポイント情報はありません")).toBeDefined();
    });
  });
});
