import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { HlsStreamingUrl, OnliveItem, RoomComment } from "@/lib/showroom";
import { ShowTubeWatchPage } from "./showtube-watch-page";

beforeEach(() => {
  class MockWebSocket {
    static OPEN = 1;
    readyState = 1;
    addEventListener(_event: string, _listener: unknown): void {}
    send(_data: string): void {}
    close(): void {}
  }
  global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

  class MockResizeObserver {
    observe(_target: Element): void {}
    disconnect(): void {}
    unobserve(_target: Element): void {}
  }
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

function makeItem(overrides: Partial<OnliveItem> = {}): OnliveItem {
  return {
    roomId: 12345,
    roomUrlKey: "test-room",
    mainName: "テストルーム",
    image: "https://example.com/image.jpg",
    imageSquare: null,
    viewNum: 42,
    followerNum: 500,
    startedAt: 1700000000,
    liveId: 1,
    genreId: 1,
    genreName: "アイドル",
    badgeList: [],
    streamingUrlList: [],
    bcsvrKey: null,
    cellType: null,
    officialLv: null,
    liveType: null,
    isFollow: false,
    tags: [],
    telop: null,
    liverThemeTitle: "",
    everydayLiveLabel: null,
    genreRankingRank: 0,
    isKaraoke: false,
    premiumRoomType: 0,
    frameImageUrl: null,
    frameLottieUrl: null,
    ...overrides,
  };
}

function makeStreamingUrl(
  overrides: Partial<HlsStreamingUrl> = {},
): HlsStreamingUrl {
  return {
    id: 1,
    label: "原画",
    quality: 0,
    url: "https://example.com/stream.m3u8",
    ...overrides,
  };
}

function makeComment(overrides: Partial<RoomComment> = {}): RoomComment {
  return {
    id: "comment-1",
    avatarId: null,
    avatarUrl: null,
    classLevel: null,
    createdAt: 1700000000,
    name: "ユーザー",
    text: "テストコメント",
    userId: "123",
    ...overrides,
  };
}

describe("ShowTubeWatchPage", () => {
  describe("オフライン状態 (item=null)", () => {
    const offlineProps = {
      item: null as null,
      roomId: 12345,
      streamingUrls: [] as HlsStreamingUrl[],
      initialComments: [] as RoomComment[],
      bcsvrKey: null as null,
    };

    it("「配信が見つかりません」を表示する", () => {
      render(<ShowTubeWatchPage {...offlineProps} />);
      expect(screen.getByText("配信が見つかりません")).toBeTruthy();
    });

    it("ルームIDをメッセージに含める", () => {
      render(<ShowTubeWatchPage {...offlineProps} roomId={99999} />);
      expect(screen.getByText(/99999/)).toBeTruthy();
    });

    it("一覧へ戻るリンクが /showtube を指す", () => {
      render(<ShowTubeWatchPage {...offlineProps} />);
      const link = screen.getByRole("link", { name: /一覧へ戻る/ });
      expect(link.getAttribute("href")).toBe("/showtube");
    });

    it("ルーム情報を表示しない", () => {
      render(<ShowTubeWatchPage {...offlineProps} />);
      expect(screen.queryByText("アイドル")).toBeNull();
    });
  });

  describe("通常表示", () => {
    const defaultProps = {
      item: makeItem(),
      roomId: 12345,
      streamingUrls: [makeStreamingUrl()],
      initialComments: [] as RoomComment[],
      bcsvrKey: null as null,
    };

    it("ルーム名を表示する", () => {
      render(<ShowTubeWatchPage {...defaultProps} />);
      expect(screen.getByText("テストルーム")).toBeTruthy();
    });

    it("ルームIDを表示する", () => {
      render(<ShowTubeWatchPage {...defaultProps} />);
      expect(screen.getByText("12345")).toBeTruthy();
    });

    it("視聴者数を表示する", () => {
      render(
        <ShowTubeWatchPage {...defaultProps} item={makeItem({ viewNum: 42 })} />,
      );
      expect(screen.getByText("42")).toBeTruthy();
    });

    it("ジャンル名を表示する", () => {
      render(<ShowTubeWatchPage {...defaultProps} />);
      expect(screen.getByText("アイドル")).toBeTruthy();
    });

    it("テロップがあれば表示する", () => {
      render(
        <ShowTubeWatchPage
          {...defaultProps}
          item={makeItem({ telop: "テストテロップ" })}
        />,
      );
      expect(screen.getByText("テストテロップ")).toBeTruthy();
    });

    it("テロップがなければ表示しない", () => {
      render(
        <ShowTubeWatchPage {...defaultProps} item={makeItem({ telop: null })} />,
      );
      expect(screen.queryByText("テストテロップ")).toBeNull();
    });

    it("isKaraoke=true のときカラオケバッジを表示する", () => {
      render(
        <ShowTubeWatchPage
          {...defaultProps}
          item={makeItem({ isKaraoke: true })}
        />,
      );
      expect(screen.getByText("カラオケ")).toBeTruthy();
    });

    it("isKaraoke=false のときカラオケバッジを表示しない", () => {
      render(
        <ShowTubeWatchPage
          {...defaultProps}
          item={makeItem({ isKaraoke: false })}
        />,
      );
      expect(screen.queryByText("カラオケ")).toBeNull();
    });

    it("streamingUrls がないときストリームエラーメッセージを表示する", () => {
      render(<ShowTubeWatchPage {...defaultProps} streamingUrls={[]} />);
      expect(
        screen.getByText("ストリーム URL が取得できませんでした"),
      ).toBeTruthy();
    });

    it("一覧へ戻るリンクが /showtube を指す", () => {
      render(<ShowTubeWatchPage {...defaultProps} />);
      const links = screen.getAllByRole("link", { name: /一覧へ戻る/ });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0].getAttribute("href")).toBe("/showtube");
    });
  });

  describe("画質セレクター", () => {
    it("複数の画質オプションを表示する", () => {
      const streamingUrls = [
        makeStreamingUrl({ id: 1, label: "原画", quality: 0 }),
        makeStreamingUrl({ id: 2, label: "高画質", quality: 1 }),
        makeStreamingUrl({ id: 3, label: "低画質", quality: 2 }),
      ];
      render(
        <ShowTubeWatchPage
          item={makeItem()}
          roomId={12345}
          streamingUrls={streamingUrls}
          initialComments={[]}
          bcsvrKey={null}
        />,
      );
      expect(screen.getByText("原画")).toBeTruthy();
      expect(screen.getByText("高画質")).toBeTruthy();
      expect(screen.getByText("低画質")).toBeTruthy();
    });

    it("画質ボタンをクリックしても表示が崩れない", () => {
      const streamingUrls = [
        makeStreamingUrl({ id: 1, label: "原画", quality: 0 }),
        makeStreamingUrl({ id: 2, label: "高画質", quality: 1 }),
      ];
      render(
        <ShowTubeWatchPage
          item={makeItem()}
          roomId={12345}
          streamingUrls={streamingUrls}
          initialComments={[]}
          bcsvrKey={null}
        />,
      );
      fireEvent.click(screen.getByText("高画質"));
      expect(screen.getByText("原画")).toBeTruthy();
      expect(screen.getByText("高画質")).toBeTruthy();
    });

    it("streamingUrls が空のとき画質セレクターを表示しない", () => {
      render(
        <ShowTubeWatchPage
          item={makeItem()}
          roomId={12345}
          streamingUrls={[]}
          initialComments={[]}
          bcsvrKey={null}
        />,
      );
      expect(screen.queryByText("画質")).toBeNull();
    });
  });

  describe("コメントパネル", () => {
    it("初期コメントを表示する", () => {
      const initialComments = [
        makeComment({ id: "c1", name: "ユーザーA", text: "はじめてのコメント" }),
      ];
      render(
        <ShowTubeWatchPage
          item={makeItem()}
          roomId={12345}
          streamingUrls={[]}
          initialComments={initialComments}
          bcsvrKey={null}
        />,
      );
      const comments = screen.getAllByText("はじめてのコメント");
      expect(comments.length).toBeGreaterThan(0);
    });

    it("コメントがなければ空メッセージを表示する", () => {
      render(
        <ShowTubeWatchPage
          item={makeItem()}
          roomId={12345}
          streamingUrls={[]}
          initialComments={[]}
          bcsvrKey={null}
        />,
      );
      const emptyMessages = screen.getAllByText("コメントはありません");
      expect(emptyMessages.length).toBeGreaterThan(0);
    });

    it("bcsvrKey=null のとき WS ステータスが「切断」になる", () => {
      render(
        <ShowTubeWatchPage
          item={makeItem()}
          roomId={12345}
          streamingUrls={[]}
          initialComments={[]}
          bcsvrKey={null}
        />,
      );
      const badges = screen.getAllByText("切断");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("bcsvrKey が提供されると WS ステータスが「接続中...」になる", () => {
      render(
        <ShowTubeWatchPage
          item={makeItem()}
          roomId={12345}
          streamingUrls={[]}
          initialComments={[]}
          bcsvrKey="test-bcsvr-key"
        />,
      );
      const badges = screen.getAllByText("接続中...");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("コメントの名前とテキストがともに表示される", () => {
      const initialComments = [
        makeComment({ name: "テストユーザー", text: "こんにちは" }),
      ];
      render(
        <ShowTubeWatchPage
          item={makeItem()}
          roomId={12345}
          streamingUrls={[]}
          initialComments={initialComments}
          bcsvrKey={null}
        />,
      );
      expect(screen.getAllByText("テストユーザー").length).toBeGreaterThan(0);
      expect(screen.getAllByText("こんにちは").length).toBeGreaterThan(0);
    });

    it("複数コメントがすべて表示される", () => {
      const initialComments = [
        makeComment({ id: "c1", name: "ユーザーA", text: "コメント1" }),
        makeComment({ id: "c2", name: "ユーザーB", text: "コメント2" }),
        makeComment({ id: "c3", name: "ユーザーC", text: "コメント3" }),
      ];
      render(
        <ShowTubeWatchPage
          item={makeItem()}
          roomId={12345}
          streamingUrls={[]}
          initialComments={initialComments}
          bcsvrKey={null}
        />,
      );
      expect(screen.getAllByText("コメント1").length).toBeGreaterThan(0);
      expect(screen.getAllByText("コメント2").length).toBeGreaterThan(0);
      expect(screen.getAllByText("コメント3").length).toBeGreaterThan(0);
    });
  });
});
