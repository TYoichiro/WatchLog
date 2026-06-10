import { describe, expect, it } from "vitest";

import {
  compareOnliveSummaries,
  computeOnliveSummary,
  type SummaryCommentInput,
  type SummaryGiftInput,
} from "@/lib/onlive-summary";

function comment(
  overrides: Partial<SummaryCommentInput> = {}
): SummaryCommentInput {
  return {
    userId: "u1",
    name: "User 1",
    avatarUrl: null,
    notice: false,
    telop: false,
    noticeTone: null,
    ...overrides,
  };
}

function gift(overrides: Partial<SummaryGiftInput> = {}): SummaryGiftInput {
  return {
    userId: "u1",
    userName: "User 1",
    avatarUrl: null,
    count: 1,
    isFree: false,
    point: 100,
    totalPoint: null,
    ...overrides,
  };
}

const emptyTotals = { freePoints: 0, paidPoints: 0, totalPoints: 0 };

describe("computeOnliveSummary", () => {
  it("counts comments and unique commenters, excluding notices and telop", () => {
    const summary = computeOnliveSummary({
      comments: [
        comment({ userId: "a", name: "A" }),
        comment({ userId: "a", name: "A" }),
        comment({ userId: "b", name: "B" }),
        comment({ notice: true, noticeTone: "follow", name: "C" }),
        comment({ telop: true, name: "テロップ" }),
      ],
      gifts: [],
      giftTotals: emptyTotals,
      followerStart: null,
      followerEnd: null,
      startedAt: null,
      endedAt: null,
    });

    expect(summary.commentCount).toBe(3);
    expect(summary.commenterCount).toBe(2);
  });

  it("counts new followers and first visits from notices", () => {
    const summary = computeOnliveSummary({
      comments: [
        comment({ notice: true, noticeTone: "follow" }),
        comment({ notice: true, noticeTone: "follow" }),
        comment({ notice: true, noticeTone: "firstVisit" }),
        comment({ notice: true, noticeTone: "ranking" }),
      ],
      gifts: [],
      giftTotals: emptyTotals,
      followerStart: null,
      followerEnd: null,
      startedAt: null,
      endedAt: null,
    });

    expect(summary.newFollowerCount).toBe(2);
    expect(summary.firstVisitCount).toBe(1);
  });

  it("ranks top gifters by accumulated points", () => {
    const summary = computeOnliveSummary({
      comments: [],
      gifts: [
        gift({ userId: "a", userName: "A", point: 100, count: 2 }),
        gift({ userId: "b", userName: "B", point: 500, count: 1 }),
        gift({ userId: "a", userName: "A", point: 50, count: 1 }),
        gift({ userId: "c", userName: "C", totalPoint: 1000, point: null }),
      ],
      giftTotals: emptyTotals,
      followerStart: null,
      followerEnd: null,
      startedAt: null,
      endedAt: null,
    });

    expect(summary.giftCount).toBe(4);
    expect(summary.gifterCount).toBe(3);
    expect(summary.topGifters.map((g) => [g.userId, g.value])).toEqual([
      ["c", 1000],
      ["b", 500],
      ["a", 250],
    ]);
  });

  it("treats free gifts with zero point as 1pt per count", () => {
    const summary = computeOnliveSummary({
      comments: [],
      gifts: [gift({ isFree: true, point: 0, count: 5, totalPoint: null })],
      giftTotals: emptyTotals,
      followerStart: null,
      followerEnd: null,
      startedAt: null,
      endedAt: null,
    });

    expect(summary.topGifters[0]?.value).toBe(5);
  });

  it("computes follower gain and duration", () => {
    const summary = computeOnliveSummary({
      comments: [],
      gifts: [],
      giftTotals: { freePoints: 10, paidPoints: 90, totalPoints: 100 },
      followerStart: 1000,
      followerEnd: 1025,
      startedAt: 1_700_000_000,
      endedAt: 1_700_003_600,
    });

    expect(summary.followerGain).toBe(25);
    expect(summary.durationSeconds).toBe(3600);
    expect(summary.totalPoints).toBe(100);
  });

  it("leaves follower gain and duration null when data is missing", () => {
    const summary = computeOnliveSummary({
      comments: [],
      gifts: [],
      giftTotals: emptyTotals,
      followerStart: null,
      followerEnd: 100,
      startedAt: null,
      endedAt: 1000,
    });

    expect(summary.followerGain).toBeNull();
    expect(summary.durationSeconds).toBeNull();
  });
});

describe("compareOnliveSummaries", () => {
  it("computes deltas between two summaries", () => {
    const base = computeOnliveSummary({
      comments: [comment({ userId: "a" }), comment({ userId: "b" })],
      gifts: [gift({ point: 100 })],
      giftTotals: { freePoints: 0, paidPoints: 100, totalPoints: 100 },
      followerStart: 10,
      followerEnd: 20,
      startedAt: 0,
      endedAt: 100,
    });
    const previous = computeOnliveSummary({
      comments: [comment({ userId: "a" })],
      gifts: [],
      giftTotals: { freePoints: 0, paidPoints: 40, totalPoints: 40 },
      followerStart: 5,
      followerEnd: 8,
      startedAt: 0,
      endedAt: 60,
    });

    const comparison = compareOnliveSummaries(base, previous);

    expect(comparison.totalPoints.delta).toBe(60);
    expect(comparison.commentCount.delta).toBe(1);
    expect(comparison.followerGain.delta).toBe(7);
    expect(comparison.durationSeconds.delta).toBe(40);
  });
});
