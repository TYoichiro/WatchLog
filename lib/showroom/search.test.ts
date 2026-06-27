import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchShowroomHtmlMock } = vi.hoisted(() => ({
  fetchShowroomHtmlMock: vi.fn(),
}));

vi.mock("./core", () => ({
  SHOWROOM_ORIGIN: "https://www.showroom-live.com",
  SHOWROOM_WEB_URL: { roomSearch: "https://www.showroom-live.com/room/search" },
  fetchShowroomHtml: fetchShowroomHtmlMock,
}));

import { searchShowroomRooms } from "./search";

beforeEach(() => {
  fetchShowroomHtmlMock.mockReset();
});

const makeRoomAnchor = ({
  roomId = "12345",
  href = "/r/test-room",
  dataSrc = "https://example.com/img_s.jpg",
  roomName = "テストルーム",
}: {
  roomId?: string;
  href?: string;
  dataSrc?: string;
  roomName?: string;
} = {}) => `
<a class="room-url" data-room-id="${roomId}" href="${href}">
  <img data-src="${dataSrc}" />
  <h4 class="listcardinfo-main-text">${roomName}</h4>
</a>
`;

describe("searchShowroomRooms", () => {
  it("空文字列のキーワードは空配列を返す（API 呼び出しなし）", async () => {
    const result = await searchShowroomRooms("   ");
    expect(result).toHaveLength(0);
    expect(fetchShowroomHtmlMock).not.toHaveBeenCalled();
  });

  it("ルームの検索結果を返す", async () => {
    fetchShowroomHtmlMock.mockResolvedValue(makeRoomAnchor());

    const result = await searchShowroomRooms("テスト");
    expect(result).toHaveLength(1);
    expect(result[0].roomId).toBe("12345");
    expect(result[0].roomUrl).toBe("test-room");
    expect(result[0].imageUrl).toBe("https://example.com/img_s.jpg");
  });

  it("ルーム名を取得する", async () => {
    fetchShowroomHtmlMock.mockResolvedValue(makeRoomAnchor({ roomName: "サンプルルーム" }));
    const result = await searchShowroomRooms("サンプル");
    expect(result[0].roomName).toBe("サンプルルーム");
  });

  it("room-url クラスを持たないアンカーは無視する", async () => {
    const html = `<a href="/r/other"><img data-src="img.jpg" /></a>`;
    fetchShowroomHtmlMock.mockResolvedValue(html);
    const result = await searchShowroomRooms("test");
    expect(result).toHaveLength(0);
  });

  it("roomId や href が欠如しているアンカーは無視する", async () => {
    const html = `<a class="room-url"><img data-src="img.jpg" /></a>`;
    fetchShowroomHtmlMock.mockResolvedValue(html);
    const result = await searchShowroomRooms("test");
    expect(result).toHaveLength(0);
  });

  it("同じ roomId と roomUrl の重複は除外する", async () => {
    const anchor = makeRoomAnchor();
    fetchShowroomHtmlMock.mockResolvedValue(anchor + anchor);
    const result = await searchShowroomRooms("test");
    expect(result).toHaveLength(1);
  });

  it("複数のルームを返す", async () => {
    const html =
      makeRoomAnchor({ roomId: "1", href: "/r/room1", roomName: "ルーム1" }) +
      makeRoomAnchor({ roomId: "2", href: "/r/room2", roomName: "ルーム2" });
    fetchShowroomHtmlMock.mockResolvedValue(html);
    const result = await searchShowroomRooms("ルーム");
    expect(result).toHaveLength(2);
  });

  it("正規化されたキーワードで URL パラメーターを設定する", async () => {
    fetchShowroomHtmlMock.mockResolvedValue("");
    await searchShowroomRooms("  テスト  ");
    const url: URL = fetchShowroomHtmlMock.mock.calls[0][0];
    expect(url.searchParams.get("keyword")).toBe("テスト");
  });

  it("API が失敗した場合はエラーをそのまま伝播する", async () => {
    fetchShowroomHtmlMock.mockRejectedValue(new Error("Showroom HTML request failed: 500"));
    await expect(searchShowroomRooms("test")).rejects.toThrow(
      "Showroom HTML request failed: 500"
    );
  });
});
