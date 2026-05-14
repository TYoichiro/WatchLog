import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoomListPage, type RoomListItem } from "./room-list-page";

const makeRoom = (overrides: Partial<RoomListItem> = {}): RoomListItem => ({
  id: "reg-1",
  roomId: "12345",
  roomUrl: "alpha-room",
  roomName: "Alpha Room",
  imageUrl: null,
  createdAt: "2026-05-01T09:00:00.000+09:00",
  user: {
    id: "user-1",
    name: "User One",
    isPremium: false,
    isAdmin: false,
  },
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RoomListPage", () => {
  it("ルームがない場合に空状態を表示する", () => {
    render(<RoomListPage rooms={[]} />);
    expect(screen.getByText("登録済みルームはありません。")).toBeDefined();
    expect(screen.getByRole("heading", { name: "ルーム一覧 0件" })).toBeDefined();
  });

  it("ルーム数を見出しに表示する", () => {
    render(<RoomListPage rooms={[makeRoom()]} />);
    expect(screen.getByRole("heading", { name: "ルーム一覧 1件" })).toBeDefined();
  });

  it("ルーム名・ルームID・ユーザー名を表示する", () => {
    render(<RoomListPage rooms={[makeRoom()]} />);
    expect(screen.getByText("Alpha Room")).toBeDefined();
    expect(screen.getByText("12345")).toBeDefined();
    expect(screen.getByText("User One")).toBeDefined();
  });

  it("ルーム名が null の場合は roomUrl をフォールバック表示する", () => {
    render(<RoomListPage rooms={[makeRoom({ roomName: null })]} />);
    expect(screen.getByText("alpha-room")).toBeDefined();
  });

  it("プロフィールリンクが正しい URL を持つ", () => {
    render(<RoomListPage rooms={[makeRoom()]} />);
    const link = screen.getByRole("link", { name: /プロフィール/ });
    expect(link.getAttribute("href")).toBe(
      "https://www.showroom-live.com/room/profile?room_id=12345",
    );
  });

  it("配信ページリンクが正しい URL を持つ", () => {
    render(<RoomListPage rooms={[makeRoom()]} />);
    const link = screen.getByRole("link", { name: /配信ページ/ });
    expect(link.getAttribute("href")).toBe(
      "https://www.showroom-live.com/r/alpha-room",
    );
  });

  it("複数ルームを正しく表示する", () => {
    const rooms = [
      makeRoom({ id: "reg-1", roomName: "Alpha Room" }),
      makeRoom({ id: "reg-2", roomId: "99999", roomUrl: "beta-room", roomName: "Beta Room", user: { id: "user-2", name: "User Two", isPremium: true, isAdmin: false } }),
    ];
    render(<RoomListPage rooms={rooms} />);
    expect(screen.getByRole("heading", { name: "ルーム一覧 2件" })).toBeDefined();
    expect(screen.getByText("Alpha Room")).toBeDefined();
    expect(screen.getByText("Beta Room")).toBeDefined();
  });
});

describe("RoleSelect", () => {
  it("一般ユーザーの場合 general が初期値", () => {
    render(<RoomListPage rooms={[makeRoom({ user: { id: "u1", name: "User", isPremium: false, isAdmin: false } })]} />);
    const select = screen.getByRole("combobox", { name: "ロール変更" }) as HTMLSelectElement;
    expect(select.value).toBe("general");
  });

  it("プレミアムユーザーの場合 premiumuser が初期値", () => {
    render(<RoomListPage rooms={[makeRoom({ user: { id: "u1", name: "User", isPremium: true, isAdmin: false } })]} />);
    const select = screen.getByRole("combobox", { name: "ロール変更" }) as HTMLSelectElement;
    expect(select.value).toBe("premiumuser");
  });

  it("プレミアムに変更すると PATCH API を呼び出す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<RoomListPage rooms={[makeRoom({ user: { id: "user-1", name: "User", isPremium: false, isAdmin: false } })]} />);
    const select = screen.getByRole("combobox", { name: "ロール変更" });

    fireEvent.change(select, { target: { value: "premiumuser" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/user-1/role",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "premiumuser" }),
        }),
      );
    });
  });

  it("一般に変更すると PATCH API を呼び出す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<RoomListPage rooms={[makeRoom({ user: { id: "user-1", name: "User", isPremium: true, isAdmin: false } })]} />);
    const select = screen.getByRole("combobox", { name: "ロール変更" });

    fireEvent.change(select, { target: { value: "general" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/user-1/role",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "general" }),
        }),
      );
    });
  });

  it("API 成功後にセレクトの値が更新される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<RoomListPage rooms={[makeRoom({ user: { id: "u1", name: "User", isPremium: false, isAdmin: false } })]} />);
    const select = screen.getByRole("combobox", { name: "ロール変更" }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "premiumuser" } });

    await waitFor(() => {
      expect(select.value).toBe("premiumuser");
    });
  });

  it("API 失敗時にエラーメッセージを表示する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    render(<RoomListPage rooms={[makeRoom({ user: { id: "u1", name: "User", isPremium: false, isAdmin: false } })]} />);
    const select = screen.getByRole("combobox", { name: "ロール変更" });

    fireEvent.change(select, { target: { value: "premiumuser" } });

    await waitFor(() => {
      expect(screen.getByText("変更に失敗しました")).toBeDefined();
    });
  });

  it("API 失敗時にセレクトの値はロールバックされない（元のままになる）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    render(<RoomListPage rooms={[makeRoom({ user: { id: "u1", name: "User", isPremium: false, isAdmin: false } })]} />);
    const select = screen.getByRole("combobox", { name: "ロール変更" }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "premiumuser" } });

    await waitFor(() => {
      expect(screen.getByText("変更に失敗しました")).toBeDefined();
    });

    expect(select.value).toBe("general");
  });

  it("fetch 中はセレクトが無効になる", async () => {
    let resolveFetch!: (value: { ok: boolean }) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<{ ok: boolean }>((r) => { resolveFetch = r; })),
    );

    render(<RoomListPage rooms={[makeRoom({ user: { id: "u1", name: "User", isPremium: false, isAdmin: false } })]} />);
    const select = screen.getByRole("combobox", { name: "ロール変更" }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "premiumuser" } });

    await waitFor(() => {
      expect(select.disabled).toBe(true);
    });

    resolveFetch({ ok: true });

    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });
  });

  it("同じ値を選択しても API を呼び出さない", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<RoomListPage rooms={[makeRoom({ user: { id: "u1", name: "User", isPremium: false, isAdmin: false } })]} />);
    const select = screen.getByRole("combobox", { name: "ロール変更" });

    fireEvent.change(select, { target: { value: "general" } });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("複数ユーザーがいる場合それぞれのロールセレクトを表示する", () => {
    const rooms = [
      makeRoom({ id: "reg-1", user: { id: "u1", name: "User1", isPremium: false, isAdmin: false } }),
      makeRoom({ id: "reg-2", roomId: "99999", roomUrl: "beta-room", user: { id: "u2", name: "User2", isPremium: true, isAdmin: false } }),
    ];
    render(<RoomListPage rooms={rooms} />);
    const selects = screen.getAllByRole("combobox", { name: "ロール変更" }) as HTMLSelectElement[];
    expect(selects).toHaveLength(2);
    expect(selects[0].value).toBe("general");
    expect(selects[1].value).toBe("premiumuser");
  });

  it("管理者ユーザーのロールセレクトを表示しない", () => {
    render(<RoomListPage rooms={[makeRoom({ user: { id: "u1", name: "Admin", isPremium: false, isAdmin: true } })]} />);
    expect(screen.queryByRole("combobox", { name: "ロール変更" })).toBeNull();
  });

  it("管理者と一般ユーザーが混在する場合、管理者のみ非表示", () => {
    const rooms = [
      makeRoom({ id: "reg-1", user: { id: "u1", name: "Admin", isPremium: false, isAdmin: true } }),
      makeRoom({ id: "reg-2", roomId: "99999", roomUrl: "beta-room", user: { id: "u2", name: "User", isPremium: false, isAdmin: false } }),
    ];
    render(<RoomListPage rooms={rooms} />);
    const selects = screen.getAllByRole("combobox", { name: "ロール変更" });
    expect(selects).toHaveLength(1);
  });
});
