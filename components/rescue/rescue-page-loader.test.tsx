import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: (
    load: () => Promise<React.ComponentType>,
    _opts?: unknown,
  ): React.ComponentType =>
    React.lazy(() => load().then((Comp) => ({ default: Comp }))),
}));

import { RescuePage } from "./rescue-page-loader";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("rescue-page-loader", () => {
  it("動的インポートされた RescuePage が空状態のメッセージをレンダリングする", async () => {
    render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <RescuePage />
      </React.Suspense>,
    );
    expect(
      await screen.findByText("ローカルストレージにログが見つかりませんでした"),
    ).toBeDefined();
  });

  it("ローカルストレージにデータがある場合はログ件数を表示する", async () => {
    const snapshot = {
      version: 1,
      roomId: 12345,
      liveId: "live-abc",
      comments: [],
      gifts: [],
      metrics: null,
      savedAt: 1767225600000,
    };
    localStorage.setItem(
      "watchlog:onlive:room-1",
      JSON.stringify(snapshot),
    );

    render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <RescuePage />
      </React.Suspense>,
    );
    expect(
      await screen.findByText("1件のログが見つかりました"),
    ).toBeDefined();
  });
});
