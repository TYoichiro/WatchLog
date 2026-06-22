import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalLogViewerPage } from "./local-log-viewer-page";

const { onliveLogViewerPageSpy } = vi.hoisted(() => ({
  onliveLogViewerPageSpy: vi.fn(),
}));

vi.mock("@/lib/onlive-local-log", () => ({
  getOnliveLocalLogKey: (roomId: string) => `watchlog:saved-log:${roomId}`,
}));

vi.mock("@/components/onlive/onlive-room-page", () => ({
  OnliveLogViewerPage: (props: Record<string, unknown>) => {
    onliveLogViewerPageSpy(props.data);
    return <div data-testid="onlive-log-viewer" />;
  },
}));

const storedLog = {
  capturedAt: "2026-05-09T12:00:00.000+09:00",
  commentCount: 10,
  giftCount: 3,
  liveId: "live-123",
  log: { comments: [], version: 1 },
  roomId: "12345",
  roomName: "テストルーム",
  savedAt: "2026-05-09T12:01:00.000+09:00",
};

const LOCAL_KEY = "watchlog:saved-log:12345";

afterEach(() => {
  cleanup();
  localStorage.clear();
  onliveLogViewerPageSpy.mockReset();
});

describe("LocalLogViewerPage", () => {
  describe("localStorageにデータがない場合", () => {
    it("エラーメッセージを表示する", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      expect(
        screen.getByText("ローカルのログが見つかりませんでした。")
      ).toBeDefined();
    });

    it("OnliveLogViewerPageを表示しない", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      expect(screen.queryByTestId("onlive-log-viewer")).toBeNull();
    });
  });

  describe("localStorageにデータがある場合", () => {
    beforeEach(() => {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(storedLog));
    });

    it("OnliveLogViewerPageを表示する", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      expect(screen.getByTestId("onlive-log-viewer")).toBeDefined();
    });

    it("エラーメッセージを表示しない", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      expect(
        screen.queryByText("ローカルのログが見つかりませんでした。")
      ).toBeNull();
    });

    it("id を local:{liveId} 形式で渡す", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      expect(onliveLogViewerPageSpy.mock.calls[0][0].id).toBe("local:live-123");
    });

    it("liveStartedAt を null で渡す", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      expect(onliveLogViewerPageSpy.mock.calls[0][0].liveStartedAt).toBeNull();
    });

    it("room を null で渡す", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      expect(onliveLogViewerPageSpy.mock.calls[0][0].room).toBeNull();
    });

    it("capturedAt は stored の capturedAt で渡す", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      expect(onliveLogViewerPageSpy.mock.calls[0][0].capturedAt).toBe(
        storedLog.capturedAt
      );
    });

    it("createdAt / updatedAt は stored の savedAt で渡す", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      const data = onliveLogViewerPageSpy.mock.calls[0][0];
      expect(data.createdAt).toBe(storedLog.savedAt);
      expect(data.updatedAt).toBe(storedLog.savedAt);
    });

    it("liveId / roomId / log を stored の値で渡す", () => {
      render(<LocalLogViewerPage roomId="12345" />);

      const data = onliveLogViewerPageSpy.mock.calls[0][0];
      expect(data.liveId).toBe("live-123");
      expect(data.roomId).toBe("12345");
      expect(data.log).toEqual({ comments: [], version: 1 });
    });
  });
});
