import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchShowroomJsonMock } = vi.hoisted(() => ({
  fetchShowroomJsonMock: vi.fn(),
}));

vi.mock("./core", () => ({
  SHOWROOM_API_URL: {
    roomProfile: "https://www.showroom-live.com/api/room/profile",
    roomStatus: "https://www.showroom-live.com/api/room/status",
    eventAndSupport: "https://www.showroom-live.com/api/room/event_and_support",
    activeFan: "https://www.showroom-live.com/api/active_fan/room",
  },
  fetchShowroomJson: fetchShowroomJsonMock,
  toFiniteNumber: (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.length > 0) {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  },
  toLargeImageUrl: (url: string) => url.replace("_s.", "_l.").replace("_m.", "_l."),
}));

vi.mock("@/lib/jst", () => ({
  toJstWallTimeDate: (d?: Date) => {
    const base = d ?? new Date("2026-06-01T03:00:00.000Z");
    return new Date(base.getTime() + 9 * 60 * 60 * 1000);
  },
}));

import {
  getRoomActiveFan,
  getRoomEventAndSupport,
  getRoomProfile,
  getRoomStatus,
} from "./room";

beforeEach(() => {
  fetchShowroomJsonMock.mockReset();
});

// ---- getRoomProfile ----

describe("getRoomProfile", () => {
  const baseProfile = {
    room_id: 12345,
    room_url_key: "test-room",
    room_name: "テストルーム",
    image: "https://example.com/img_s.jpg",
    is_onlive: true,
    premium_room_type: 0,
    follower_num: 10000,
    view_num: 500,
    genre_name: "アイドル",
    is_official: false,
    room_level: 50,
    league_label: "SS-1",
    show_rank_subdivided: "SS-1",
    next_show_rank_subdivided: "SS-2",
    current_live_started_at: 1700000000,
  };

  it("ルームプロフィールを正規化して返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue(baseProfile);

    const result = await getRoomProfile(12345);

    expect(result.roomId).toBe(12345);
    expect(result.roomName).toBe("テストルーム");
    expect(result.isOnlive).toBe(true);
    expect(result.leagueLabel).toBe("SS-1");
    expect(result.currentLiveStartedAt).toBe(1700000000);
  });

  it("画像 URL を _l. に変換する", async () => {
    fetchShowroomJsonMock.mockResolvedValue(baseProfile);
    const result = await getRoomProfile(12345);
    expect(result.roomImageUrl).toBe("https://example.com/img_l.jpg");
  });

  it("follower_num を locale 文字列に変換する", async () => {
    fetchShowroomJsonMock.mockResolvedValue(baseProfile);
    const result = await getRoomProfile(12345);
    expect(typeof result.followerNum).toBe("string");
    expect(result.followerNum).toContain("10");
  });

  it("show_rank_subdivided に対応する timeCharge を返す（SS-1 → ¥3,600）", async () => {
    fetchShowroomJsonMock.mockResolvedValue(baseProfile);
    const result = await getRoomProfile(12345);
    expect(result.showRankTimeCharge).toBe("¥3,600");
  });

  it("対応する timeCharge がない rank は null を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      ...baseProfile,
      show_rank_subdivided: "C-1",
    });
    const result = await getRoomProfile(12345);
    expect(result.showRankTimeCharge).toBeNull();
  });
});

// ---- getRoomStatus ----

describe("getRoomStatus", () => {
  const baseStatus = {
    broadcast_host: "host.example.com",
    broadcast_key: "abc123",
    broadcast_port: 1935,
    is_live: true,
    live_status: 2,
    room_id: 12345,
    room_url_key: "test-room",
  };

  it("ルームステータスを正規化して返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue(baseStatus);

    const result = await getRoomStatus("test-room");

    expect(result.isLive).toBe(true);
    expect(result.broadcastHost).toBe("host.example.com");
    expect(result.broadcastKey).toBe("abc123");
    expect(result.liveStatus).toBe(2);
  });

  it("空の room_url_key は Error を投げる", async () => {
    await expect(getRoomStatus("   ")).rejects.toThrow("room_url_key is required");
  });

  it("is_live が false の場合は isLive が false", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ ...baseStatus, is_live: false });
    const result = await getRoomStatus("test-room");
    expect(result.isLive).toBe(false);
  });

  it("broadcast_host が null の場合は broadcastHost が null", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ ...baseStatus, broadcast_host: null });
    const result = await getRoomStatus("test-room");
    expect(result.broadcastHost).toBeNull();
  });
});

// ---- getRoomEventAndSupport ----

describe("getRoomEventAndSupport", () => {
  it("イベントとサポートを返す（ランキング含む）", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      event: {
        event_id: 1,
        event_name: "テストイベント",
        image: "https://example.com/event_s.jpg",
        started_at: 1700000000,
        ended_at: 1700003600,
        event_url: "https://example.com/event",
        ranking: { rank: 5, before_rank: 3, point: 1234, gap: 100 },
      },
      support: { support_id: 10, name: "サポートチーム" },
    });

    const result = await getRoomEventAndSupport(12345);

    expect(result.event).not.toBeNull();
    expect(result.event!.id).toBe(1);
    expect(result.event!.name).toBe("テストイベント");
    expect(result.support!.id).toBe(10);
    expect(result.ranking!.rank).toBe(5);
    expect(typeof result.ranking!.point).toBe("string");
  });

  it("event が null の場合は event と ranking が null", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ event: null, support: null });
    const result = await getRoomEventAndSupport(12345);
    expect(result.event).toBeNull();
    expect(result.ranking).toBeNull();
  });

  it("event があっても ranking がない場合は ranking が null", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      event: {
        event_id: 1,
        event_name: "テスト",
        image: "img.jpg",
        started_at: 1000,
        ended_at: 2000,
        event_url: "url",
      },
      support: null,
    });
    const result = await getRoomEventAndSupport(12345);
    expect(result.ranking).toBeNull();
  });
});

// ---- getRoomActiveFan ----

describe("getRoomActiveFan", () => {
  it("アクティブファン情報を返す", async () => {
    fetchShowroomJsonMock.mockResolvedValue({
      fan_name: "ファンネーム",
      total_user_count: 1234,
    });

    const result = await getRoomActiveFan(12345);

    expect(result.fanName).toBe("ファンネーム");
    expect(typeof result.totalUserCount).toBe("string");
    expect(result.totalUserCount).toContain("1");
  });

  it("ym パラメーターが URL に含まれる", async () => {
    fetchShowroomJsonMock.mockResolvedValue({ fan_name: "n", total_user_count: 0 });

    const now = new Date("2026-06-01T03:00:00.000Z");
    await getRoomActiveFan(12345, now);

    const url: URL = fetchShowroomJsonMock.mock.calls[0][0];
    const ym = url.searchParams.get("ym");
    expect(ym).toMatch(/^\d{6}$/);
  });
});
