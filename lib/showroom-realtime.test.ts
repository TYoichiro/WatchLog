import { describe, expect, it } from "vitest";

import {
  createShowroomSubscribeMessage,
  getShowroomSocketPayloadText,
  isLiveStartedSocketMessage,
  SHOWROOM_LIVE_STARTED_MESSAGE_TYPE,
  SHOWROOM_SOCKET_ACK_MESSAGE,
  SHOWROOM_SOCKET_PING_MESSAGE,
  SHOWROOM_SOCKET_URL,
} from "./showroom-realtime";

describe("定数", () => {
  it("SHOWROOM_SOCKET_URL が正しい値", () => {
    expect(SHOWROOM_SOCKET_URL).toBe("wss://online.showroom-live.com/");
  });

  it("SHOWROOM_SOCKET_ACK_MESSAGE が正しい値", () => {
    expect(SHOWROOM_SOCKET_ACK_MESSAGE).toBe("ACK\tshowroom");
  });

  it("SHOWROOM_SOCKET_PING_MESSAGE が正しい値", () => {
    expect(SHOWROOM_SOCKET_PING_MESSAGE).toBe("PING\tshowroom");
  });

  it("SHOWROOM_LIVE_STARTED_MESSAGE_TYPE が 104", () => {
    expect(SHOWROOM_LIVE_STARTED_MESSAGE_TYPE).toBe(104);
  });
});

describe("createShowroomSubscribeMessage", () => {
  it("SUB\\t{key} 形式の文字列を返す", () => {
    expect(createShowroomSubscribeMessage("bcsvr-key-abc")).toBe(
      "SUB\tbcsvr-key-abc",
    );
  });

  it("空のキーでも正しくフォーマットする", () => {
    expect(createShowroomSubscribeMessage("")).toBe("SUB\t");
  });
});

describe("getShowroomSocketPayloadText", () => {
  const key = "bcsvr-key-test";

  it("ACK メッセージには null を返す", () => {
    expect(getShowroomSocketPayloadText(SHOWROOM_SOCKET_ACK_MESSAGE, key)).toBeNull();
  });

  it("UTF-8 デコードエラーメッセージには null を返す", () => {
    expect(
      getShowroomSocketPayloadText(
        "Could not decode a text frame as UTF-8.",
        key,
      ),
    ).toBeNull();
  });

  it("MSG\\t{key}\\t{payload} 形式ならペイロードを返す", () => {
    const payload = '{"t":104}';
    const message = `MSG\t${key}\t${payload}`;
    expect(getShowroomSocketPayloadText(message, key)).toBe(payload);
  });

  it("別キーの MSG でも JSON 開始位置のテキストを返す", () => {
    const otherKey = "other-key";
    const message = `MSG\t${otherKey}\t{"t":104}`;
    expect(getShowroomSocketPayloadText(message, key)).toBe('{"t":104}');
  });

  it("MSG\\t 以外で始まるメッセージには null を返す", () => {
    expect(getShowroomSocketPayloadText("UNKNOWN\tdata", key)).toBeNull();
    expect(getShowroomSocketPayloadText("PING\tshowroom", key)).toBeNull();
  });

  it("MSG\\t{key}\\t の後が空でも空文字列を返す", () => {
    const message = `MSG\t${key}\t`;
    expect(getShowroomSocketPayloadText(message, key)).toBe("");
  });

  it("JSON が含まれない MSG メッセージには null を返す", () => {
    const message = "MSG\tother-key\tno-json-here";
    expect(getShowroomSocketPayloadText(message, key)).toBeNull();
  });
});

describe("isLiveStartedSocketMessage", () => {
  const key = "bcsvr-key-test";

  function makeMsgPayload(payload: string): string {
    return `MSG\t${key}\t${payload}`;
  }

  it("type=104 のメッセージに対して true を返す（数値）", () => {
    const message = makeMsgPayload(JSON.stringify({ t: 104 }));
    expect(isLiveStartedSocketMessage(message, key)).toBe(true);
  });

  it("type=104 のメッセージに対して true を返す（文字列）", () => {
    const message = makeMsgPayload(JSON.stringify({ t: "104" }));
    expect(isLiveStartedSocketMessage(message, key)).toBe(true);
  });

  it("type が 104 以外のメッセージには false を返す", () => {
    const message = makeMsgPayload(JSON.stringify({ t: 101 }));
    expect(isLiveStartedSocketMessage(message, key)).toBe(false);
  });

  it("type フィールドがないメッセージには false を返す", () => {
    const message = makeMsgPayload(JSON.stringify({ other: "data" }));
    expect(isLiveStartedSocketMessage(message, key)).toBe(false);
  });

  it("type が null のメッセージには false を返す", () => {
    const message = makeMsgPayload(JSON.stringify({ t: null }));
    expect(isLiveStartedSocketMessage(message, key)).toBe(false);
  });

  it("ACK メッセージには false を返す", () => {
    expect(isLiveStartedSocketMessage(SHOWROOM_SOCKET_ACK_MESSAGE, key)).toBe(false);
  });

  it("JSON ではないペイロードには false を返す", () => {
    const message = makeMsgPayload("not-json");
    expect(isLiveStartedSocketMessage(message, key)).toBe(false);
  });

  it("壊れた JSON には false を返す", () => {
    const message = makeMsgPayload("{invalid json}");
    expect(isLiveStartedSocketMessage(message, key)).toBe(false);
  });

  it("null ペイロードには false を返す（オブジェクトでない）", () => {
    const message = makeMsgPayload("null");
    expect(isLiveStartedSocketMessage(message, key)).toBe(false);
  });

  it("別キーでも { t: 104 } を含む場合は true を返す", () => {
    const otherKey = "other-key";
    const message = `MSG\t${otherKey}\t${JSON.stringify({ t: 104 })}`;
    expect(isLiveStartedSocketMessage(message, key)).toBe(true);
  });

  it("非有限数の t 値には false を返す", () => {
    const message = makeMsgPayload(JSON.stringify({ t: "abc" }));
    expect(isLiveStartedSocketMessage(message, key)).toBe(false);
  });
});
