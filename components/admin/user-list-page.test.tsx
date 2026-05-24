import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserListPage, type UserListItem } from "./user-list-page";

const makeUser = (overrides: Partial<UserListItem> = {}): UserListItem => ({
  id: "user-1",
  name: "User One",
  email: "user1@example.com",
  image: null,
  isBanned: false,
  createdAt: "2026-05-01T09:00:00.000+09:00",
  roles: [{ name: "user" }],
  registeredRoom: null,
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UserListPage", () => {
  it("ユーザーがいない場合に空状態を表示する", () => {
    render(<UserListPage users={[]} currentUserId="admin-1" />);
    expect(screen.getByText("ユーザーはいません。")).toBeDefined();
    expect(screen.getByRole("heading", { name: "ユーザー一覧 0件" })).toBeDefined();
  });

  it("ユーザー数を見出しに表示する", () => {
    render(<UserListPage users={[makeUser()]} currentUserId="admin-1" />);
    expect(screen.getByRole("heading", { name: "ユーザー一覧 1件" })).toBeDefined();
  });

  it("名前・メールアドレスを表示する", () => {
    render(<UserListPage users={[makeUser()]} currentUserId="admin-1" />);
    expect(screen.getByText("User One")).toBeDefined();
    expect(screen.getByText("user1@example.com")).toBeDefined();
  });

  it("名前が null の場合は（名前未設定）を表示する", () => {
    render(<UserListPage users={[makeUser({ name: null })]} currentUserId="admin-1" />);
    expect(screen.getByText("（名前未設定）")).toBeDefined();
  });

  it("BAN されたユーザーが 1 件以上いると警告を表示する", () => {
    render(<UserListPage users={[makeUser({ isBanned: true })]} currentUserId="admin-1" />);
    expect(screen.getByText(/1件のBANユーザーがいます/)).toBeDefined();
  });

  it("BAN ユーザーがいない場合は警告を表示しない", () => {
    render(<UserListPage users={[makeUser({ isBanned: false })]} currentUserId="admin-1" />);
    expect(screen.queryByText(/BANユーザー/)).toBeNull();
  });

  it("BAN されたユーザーに BAN バッジを表示する", () => {
    render(<UserListPage users={[makeUser({ isBanned: true })]} currentUserId="admin-1" />);
    expect(screen.getAllByText("BAN").length).toBeGreaterThan(0);
  });

  it("管理者ユーザーに管理者バッジを表示する", () => {
    render(
      <UserListPage
        users={[makeUser({ roles: [{ name: "admin" }] })]}
        currentUserId="other-user"
      />,
    );
    expect(screen.getAllByText("管理者").length).toBeGreaterThan(0);
  });

  it("自分のエントリに「自分」バッジを表示する", () => {
    render(<UserListPage users={[makeUser({ id: "admin-1" })]} currentUserId="admin-1" />);
    expect(screen.getByText("自分")).toBeDefined();
  });

  it("複数ユーザーを正しく表示する", () => {
    const users = [
      makeUser({ id: "user-1", name: "User One" }),
      makeUser({ id: "user-2", name: "User Two", email: "user2@example.com" }),
    ];
    render(<UserListPage users={users} currentUserId="admin-1" />);
    expect(screen.getByRole("heading", { name: "ユーザー一覧 2件" })).toBeDefined();
    expect(screen.getByText("User One")).toBeDefined();
    expect(screen.getByText("User Two")).toBeDefined();
  });

  it("ルーム未登録の場合「未登録」を表示する", () => {
    render(<UserListPage users={[makeUser({ registeredRoom: null })]} currentUserId="admin-1" />);
    expect(screen.getByText("未登録")).toBeDefined();
  });

  it("ルーム登録済みの場合ルーム名を表示する", () => {
    render(
      <UserListPage
        users={[makeUser({ registeredRoom: { roomId: "12345", roomUrl: "alpha-room", roomName: "Alpha Room" } })]}
        currentUserId="admin-1"
      />,
    );
    expect(screen.getByText("Alpha Room")).toBeDefined();
    expect(screen.queryByText("未登録")).toBeNull();
  });

  it("ルーム名が null の場合は roomUrl をフォールバック表示する", () => {
    render(
      <UserListPage
        users={[makeUser({ registeredRoom: { roomId: "12345", roomUrl: "alpha-room", roomName: null } })]}
        currentUserId="admin-1"
      />,
    );
    expect(screen.getByText("alpha-room")).toBeDefined();
  });

  it("メールが null の場合「（メール未設定）」を表示する", () => {
    render(<UserListPage users={[makeUser({ email: null })]} currentUserId="admin-1" />);
    expect(screen.getByText("（メール未設定）")).toBeDefined();
  });

  it("BAN ユーザーが複数いると正しい件数を警告に表示する", () => {
    const users = [
      makeUser({ id: "user-1", isBanned: true }),
      makeUser({ id: "user-2", name: "User Two", email: "user2@example.com", isBanned: true }),
    ];
    render(<UserListPage users={users} currentUserId="admin-1" />);
    expect(screen.getByText(/2件のBANユーザーがいます/)).toBeDefined();
  });
});

describe("BanSelect", () => {
  it("BAN されていないユーザーは「許可」が初期値", () => {
    render(<UserListPage users={[makeUser({ isBanned: false })]} currentUserId="admin-1" />);
    const select = screen.getByRole("combobox", { name: "ステータス変更" }) as HTMLSelectElement;
    expect(select.value).toBe("allowed");
  });

  it("BAN されているユーザーは「BAN」が初期値", () => {
    render(<UserListPage users={[makeUser({ isBanned: true })]} currentUserId="admin-1" />);
    const select = screen.getByRole("combobox", { name: "ステータス変更" }) as HTMLSelectElement;
    expect(select.value).toBe("banned");
  });

  it("BAN に変更すると PATCH API を呼び出す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserListPage users={[makeUser({ id: "user-1", isBanned: false })]} currentUserId="admin-1" />);
    const select = screen.getByRole("combobox", { name: "ステータス変更" });

    fireEvent.change(select, { target: { value: "banned" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/user-1/ban",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ banned: true }),
        }),
      );
    });
  });

  it("許可に戻すと banned: false で PATCH API を呼び出す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserListPage users={[makeUser({ id: "user-1", isBanned: true })]} currentUserId="admin-1" />);
    const select = screen.getByRole("combobox", { name: "ステータス変更" });

    fireEvent.change(select, { target: { value: "allowed" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/user-1/ban",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ banned: false }),
        }),
      );
    });
  });

  it("API 成功後にセレクトの値が更新される", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<UserListPage users={[makeUser({ id: "user-1", isBanned: false })]} currentUserId="admin-1" />);
    const select = screen.getByRole("combobox", { name: "ステータス変更" }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "banned" } });

    await waitFor(() => {
      expect(select.value).toBe("banned");
    });
  });

  it("API 失敗時にエラーメッセージを表示する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    render(<UserListPage users={[makeUser({ id: "user-1", isBanned: false })]} currentUserId="admin-1" />);
    const select = screen.getByRole("combobox", { name: "ステータス変更" });

    fireEvent.change(select, { target: { value: "banned" } });

    await waitFor(() => {
      expect(screen.getByText("変更に失敗しました")).toBeDefined();
    });
  });

  it("API 失敗時にセレクトの値はロールバックされない（元のままになる）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    render(<UserListPage users={[makeUser({ id: "user-1", isBanned: false })]} currentUserId="admin-1" />);
    const select = screen.getByRole("combobox", { name: "ステータス変更" }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "banned" } });

    await waitFor(() => {
      expect(screen.getByText("変更に失敗しました")).toBeDefined();
    });

    expect(select.value).toBe("allowed");
  });

  it("fetch 中はセレクトが無効になる", async () => {
    let resolveFetch!: (value: { ok: boolean }) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<{ ok: boolean }>((r) => { resolveFetch = r; })),
    );

    render(<UserListPage users={[makeUser({ id: "user-1", isBanned: false })]} currentUserId="admin-1" />);
    const select = screen.getByRole("combobox", { name: "ステータス変更" }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "banned" } });

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

    render(<UserListPage users={[makeUser({ id: "user-1", isBanned: false })]} currentUserId="admin-1" />);
    const select = screen.getByRole("combobox", { name: "ステータス変更" });

    fireEvent.change(select, { target: { value: "allowed" } });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("管理者ユーザーはセレクトを表示しない（操作不可テキストを表示）", () => {
    render(
      <UserListPage
        users={[makeUser({ id: "user-2", roles: [{ name: "admin" }] })]}
        currentUserId="admin-1"
      />,
    );
    expect(screen.queryByRole("combobox", { name: "ステータス変更" })).toBeNull();
    // バッジと BanSelect の両方に「管理者」テキストが表示される
    expect(screen.getAllByText("管理者").length).toBeGreaterThanOrEqual(1);
  });

  it("自分自身はセレクトを表示せず操作不可を表示する", () => {
    render(
      <UserListPage
        users={[makeUser({ id: "admin-1" })]}
        currentUserId="admin-1"
      />,
    );
    expect(screen.queryByRole("combobox", { name: "ステータス変更" })).toBeNull();
    expect(screen.getByText("操作不可")).toBeDefined();
  });

  it("複数ユーザーがいる場合それぞれのセレクトを表示する", () => {
    const users = [
      makeUser({ id: "user-1", isBanned: false }),
      makeUser({ id: "user-2", name: "User Two", isBanned: true }),
    ];
    render(<UserListPage users={users} currentUserId="admin-1" />);
    const selects = screen.getAllByRole("combobox", { name: "ステータス変更" }) as HTMLSelectElement[];
    expect(selects).toHaveLength(2);
    expect(selects[0].value).toBe("allowed");
    expect(selects[1].value).toBe("banned");
  });
});
