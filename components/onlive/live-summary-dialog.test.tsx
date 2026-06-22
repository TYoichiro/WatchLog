import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OnliveSummary, OnliveSummaryComparison } from "@/lib/onlive-summary";
import { LiveSummaryDialog } from "./live-summary-dialog";

const baseSummary: OnliveSummary = {
  durationSeconds: 3661,
  startedAt: null,
  endedAt: null,
  totalPoints: 1500,
  paidPoints: 1000,
  freePoints: 500,
  followerStart: 100,
  followerEnd: 105,
  followerGain: 5,
  newFollowerCount: 3,
  firstVisitCount: 2,
  commentCount: 50,
  commenterCount: 10,
  giftCount: 20,
  gifterCount: 5,
  topGifters: [
    { userId: "u1", userName: "ギフター太郎", avatarUrl: null, value: 800 },
  ],
  topCommenters: [
    { userId: "u2", userName: "コメンター花子", avatarUrl: null, value: 30 },
  ],
};

const baseComparison: OnliveSummaryComparison = {
  totalPoints: { current: 1500, previous: 1000, delta: 500 },
  paidPoints: { current: 1000, previous: 800, delta: 200 },
  freePoints: { current: 500, previous: 200, delta: 300 },
  followerGain: { current: 5, previous: 3, delta: 2 },
  newFollowerCount: { current: 3, previous: 2, delta: 1 },
  commentCount: { current: 50, previous: 40, delta: 10 },
  commenterCount: { current: 10, previous: 8, delta: 2 },
  giftCount: { current: 20, previous: 15, delta: 5 },
  gifterCount: { current: 5, previous: 4, delta: 1 },
  durationSeconds: { current: 3661, previous: 3000, delta: 661 },
};

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /配信サマリー/ }));
}

describe("LiveSummaryDialog", () => {
  it("「配信サマリー」ボタンが表示される", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={null}
        previousLabel={null}
      />
    );
    expect(screen.getByRole("button", { name: /配信サマリー/ })).toBeDefined();
  });

  it("初期状態ではダイアログが表示されない", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={null}
        previousLabel={null}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ボタンをクリックするとダイアログが開く", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("comparison=null のとき「保存された過去ログがある場合」という説明文が表示される", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(
      screen.getByText(/保存された過去ログがある場合に表示されます/)
    ).toBeDefined();
  });

  it("comparison があり previousLabel=null のとき「前回配信との比較を表示しています」が表示される", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={baseComparison}
        previousLabel={null}
      />
    );
    openDialog();
    expect(
      screen.getByText(/前回配信との比較を表示しています/)
    ).toBeDefined();
  });

  it("comparison があり previousLabel がある場合「前回（xxx）との比較」が表示される", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={baseComparison}
        previousLabel="2024/01/01"
      />
    );
    openDialog();
    expect(
      screen.getByText(/前回（2024\/01\/01）との比較を表示しています/)
    ).toBeDefined();
  });

  it("配信時間が時間・分で表示される（3661秒 → 1時間01分）", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("1時間01分")).toBeDefined();
  });

  it("配信時間が秒単位（1時間未満）の場合は分・秒で表示される", () => {
    const summary = { ...baseSummary, durationSeconds: 125 };
    render(
      <LiveSummaryDialog
        summary={summary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("2分05秒")).toBeDefined();
  });

  it("durationSeconds=null のとき「--」が表示される", () => {
    const summary = { ...baseSummary, durationSeconds: null };
    render(
      <LiveSummaryDialog
        summary={summary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("--")).toBeDefined();
  });

  it("獲得ポイントが表示される", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("1,500 pt")).toBeDefined();
  });

  it("フォロワー増加が正のとき「+5 人」が表示される", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("+5 人")).toBeDefined();
  });

  it("フォロワー増減が null のとき「-- 人」が表示される", () => {
    const summary = {
      ...baseSummary,
      followerGain: null,
      followerStart: null,
      followerEnd: null,
    };
    render(
      <LiveSummaryDialog
        summary={summary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("-- 人")).toBeDefined();
  });

  it("トップギフターの名前が表示される", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("ギフター太郎")).toBeDefined();
  });

  it("トップコメンターの名前が表示される", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("コメンター花子")).toBeDefined();
  });

  it("ギフターがいない場合「ギフトはありませんでした」が表示される", () => {
    const summary = { ...baseSummary, topGifters: [] };
    render(
      <LiveSummaryDialog
        summary={summary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("ギフトはありませんでした")).toBeDefined();
  });

  it("コメンターがいない場合「コメントはありませんでした」が表示される", () => {
    const summary = { ...baseSummary, topCommenters: [] };
    render(
      <LiveSummaryDialog
        summary={summary}
        comparison={null}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText("コメントはありませんでした")).toBeDefined();
  });

  it("前回比デルタバッジが表示される（ポイント増加）", () => {
    render(
      <LiveSummaryDialog
        summary={baseSummary}
        comparison={baseComparison}
        previousLabel={null}
      />
    );
    openDialog();
    expect(screen.getByText(/前回比 \+500 pt/)).toBeDefined();
  });
});
