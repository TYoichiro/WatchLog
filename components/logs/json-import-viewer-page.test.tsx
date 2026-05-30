import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JsonImportViewerPage } from "./json-import-viewer-page";

const { readJsonViewerLogMock, onliveLogViewerPageSpy } = vi.hoisted(() => ({
  readJsonViewerLogMock: vi.fn(),
  onliveLogViewerPageSpy: vi.fn(),
}));

vi.mock("@/lib/onlive-local-log", () => ({
  readJsonViewerLog: readJsonViewerLogMock,
}));

vi.mock("@/components/onlive/onlive-room-page", () => ({
  OnliveLogViewerPage: (props: Record<string, unknown>) => {
    onliveLogViewerPageSpy(props.data);
    return <div data-testid="onlive-log-viewer" />;
  },
}));

const storedLog = {
  capturedAt: "2026-05-09T12:00:00.000+09:00",
  liveId: "live-123",
  log: { comments: [], version: 1 },
  roomId: "12345",
};

afterEach(() => {
  cleanup();
  readJsonViewerLogMock.mockReset();
  onliveLogViewerPageSpy.mockReset();
});

describe("JsonImportViewerPage", () => {
  describe("localStorageにデータがない場合", () => {
    it("エラーメッセージを表示する", () => {
      readJsonViewerLogMock.mockReturnValue(null);

      render(<JsonImportViewerPage />);

      expect(
        screen.getByText(
          "JSONログが見つかりませんでした。ログ一覧からJSONファイルを選択してください。"
        )
      ).toBeDefined();
    });

    it("OnliveLogViewerPageを表示しない", () => {
      readJsonViewerLogMock.mockReturnValue(null);

      render(<JsonImportViewerPage />);

      expect(screen.queryByTestId("onlive-log-viewer")).toBeNull();
    });
  });

  describe("localStorageにデータがある場合", () => {
    it("OnliveLogViewerPageを表示する", () => {
      readJsonViewerLogMock.mockReturnValue(storedLog);

      render(<JsonImportViewerPage />);

      expect(screen.getByTestId("onlive-log-viewer")).toBeDefined();
    });

    it("エラーメッセージを表示しない", () => {
      readJsonViewerLogMock.mockReturnValue(storedLog);

      render(<JsonImportViewerPage />);

      expect(
        screen.queryByText(
          "JSONログが見つかりませんでした。ログ一覧からJSONファイルを選択してください。"
        )
      ).toBeNull();
    });

    it("idを json-import:{liveId} 形式で渡す", () => {
      readJsonViewerLogMock.mockReturnValue(storedLog);

      render(<JsonImportViewerPage />);

      expect(onliveLogViewerPageSpy.mock.calls[0][0].id).toBe(
        "json-import:live-123"
      );
    });

    it("liveStartedAt を null で渡す", () => {
      readJsonViewerLogMock.mockReturnValue(storedLog);

      render(<JsonImportViewerPage />);

      expect(onliveLogViewerPageSpy.mock.calls[0][0].liveStartedAt).toBeNull();
    });

    it("room を null で渡す", () => {
      readJsonViewerLogMock.mockReturnValue(storedLog);

      render(<JsonImportViewerPage />);

      expect(onliveLogViewerPageSpy.mock.calls[0][0].room).toBeNull();
    });

    it("capturedAt / createdAt / updatedAt はすべて stored.capturedAt で渡す", () => {
      readJsonViewerLogMock.mockReturnValue(storedLog);

      render(<JsonImportViewerPage />);

      const data = onliveLogViewerPageSpy.mock.calls[0][0];
      expect(data.capturedAt).toBe(storedLog.capturedAt);
      expect(data.createdAt).toBe(storedLog.capturedAt);
      expect(data.updatedAt).toBe(storedLog.capturedAt);
    });

    it("liveId / roomId / log を stored の値で渡す", () => {
      readJsonViewerLogMock.mockReturnValue(storedLog);

      render(<JsonImportViewerPage />);

      const data = onliveLogViewerPageSpy.mock.calls[0][0];
      expect(data.liveId).toBe("live-123");
      expect(data.roomId).toBe("12345");
      expect(data.log).toEqual({ comments: [], version: 1 });
    });
  });
});
