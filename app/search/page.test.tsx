import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomResult } from "@/types/pages/search";
import ShowroomRoomSearchPage from "./page";

const { routerReplace } = vi.hoisted(() => ({
  routerReplace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
  }),
}));

vi.mock("@/components/navigation/app-sidebar", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

const inviteDialogTitle = "\u62db\u5f85\u30b3\u30fc\u30c9\u3092\u5165\u529b";
const inviteHelpText =
  "10\u6841\u306e\u82f1\u6570\u5b57\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
const lockedInviteMessage =
  "\u767b\u9332\u306f\u3067\u304d\u307e\u305b\u3093\u3002\u62db\u5f85\u30b3\u30fc\u30c9\u306e\u5165\u529b\u306b4\u56de\u5931\u6557\u3057\u307e\u3057\u305f\u3002";
const searchInputPlaceholder =
  "\u30eb\u30fc\u30e0\u540d\u3092\u691c\u7d22";
const searchButtonLabel = "\u691c\u7d22";
const confirmButtonLabel = "\u78ba\u8a8d";
const registerDialogTitle = "\u767b\u9332\u3057\u307e\u3059\u304b\uff1f";
const registerButtonLabel = "\u306f\u3044";

const sampleRoom: RoomResult = {
  imageUrl: "https://static.showroom-live.com/room.jpg",
  roomId: "12345",
  roomName: "Alpha Room",
  roomUrl: "https://www.showroom-live.com/r/alpha",
};

const fetchMock = vi.fn<typeof fetch>();

type RegisteredRoom = {
  imageUrl: string | null;
  roomId: string;
  roomName: string | null;
  roomUrl: string;
};

type FetchScenario = {
  registeredRoom?: RegisteredRoom | null;
  inviteValid?: boolean;
  registerOk?: boolean;
  rooms?: RoomResult[];
  savedRoom?: RegisteredRoom;
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
    ...init,
  });
}

function getFetchUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function setupFetchScenario({
  inviteValid = true,
  registerOk = true,
  registeredRoom = null,
  rooms = [],
  savedRoom = {
    imageUrl: sampleRoom.imageUrl,
    roomId: sampleRoom.roomId,
    roomName: sampleRoom.roomName,
    roomUrl: sampleRoom.roomUrl,
  },
}: FetchScenario = {}) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = getFetchUrl(input);
    const method = init?.method ?? "GET";

    if (url === "/api/registered-room" && method === "PUT") {
      if (!registerOk) {
        return jsonResponse({ error: "ルームを登録できませんでした" }, { status: 500 });
      }
      return jsonResponse({ room: savedRoom });
    }

    if (url === "/api/registered-room") {
      return jsonResponse({ room: registeredRoom });
    }

    if (url === "/api/invitations/verify") {
      return jsonResponse({ valid: inviteValid });
    }

    if (url.startsWith("/api/room/search?")) {
      return jsonResponse({ rooms });
    }

    throw new Error(`Unhandled fetch URL: ${url}`);
  });
}

function fetchCallsFor(path: string) {
  return fetchMock.mock.calls.filter(([input]) => getFetchUrl(input).startsWith(path));
}

async function renderSearchPage() {
  render(<ShowroomRoomSearchPage />);

  await screen.findByRole("dialog", { name: inviteDialogTitle });
}

async function verifyInviteCode(code = "abcd123456") {
  const inviteInput = screen.getByPlaceholderText("ABCD123456");
  fireEvent.change(inviteInput, { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: confirmButtonLabel }));

  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: inviteDialogTitle })).toBeNull();
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  routerReplace.mockReset();
  window.localStorage.clear();
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

describe("ShowroomRoomSearchPage", () => {
  it("redirects to the dashboard when a room is already registered", async () => {
    setupFetchScenario({
      registeredRoom: {
        imageUrl: sampleRoom.imageUrl,
        roomId: sampleRoom.roomId,
        roomName: sampleRoom.roomName,
        roomUrl: sampleRoom.roomUrl,
      },
    });

    render(<ShowroomRoomSearchPage />);

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/dashboard");
    });
    expect(screen.queryByPlaceholderText(searchInputPlaceholder)).toBeNull();
  });

  it("shows the invite-code gate and search UI when no room is registered", async () => {
    setupFetchScenario();

    await renderSearchPage();

    expect(screen.getByTestId("app-shell")).toBeDefined();
    expect(screen.getByPlaceholderText(searchInputPlaceholder)).toBeDefined();
    expect(screen.getByRole("button", { name: searchButtonLabel })).toBeDefined();
    expect(screen.getByText(inviteHelpText)).toBeDefined();
  });

  it("verifies the invite code, searches rooms, and renders search results", async () => {
    setupFetchScenario({ rooms: [sampleRoom] });

    await renderSearchPage();
    await verifyInviteCode();

    const inviteVerifyCall = fetchCallsFor("/api/invitations/verify")[0];
    expect(inviteVerifyCall?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ inviteCode: "ABCD123456" }),
        method: "POST",
      }),
    );

    fireEvent.change(screen.getByPlaceholderText(searchInputPlaceholder), {
      target: { value: "Alpha" },
    });
    fireEvent.click(screen.getByRole("button", { name: searchButtonLabel }));

    expect(await screen.findByText("Alpha Room")).toBeDefined();
    expect(screen.getByText("Alpha / 1\u4ef6")).toBeDefined();
    expect(screen.getByText(sampleRoom.roomId)).toBeDefined();
    expect(screen.getByText(sampleRoom.roomUrl)).toBeDefined();

    const searchCall = fetchCallsFor("/api/room/search")[0];
    expect(getFetchUrl(searchCall[0])).toBe("/api/room/search?keyword=Alpha");
    expect(searchCall[1]).toEqual(expect.objectContaining({ cache: "no-store" }));
  });

  it("registers a selected room with the verified invite code", async () => {
    setupFetchScenario({ rooms: [sampleRoom] });

    await renderSearchPage();
    await verifyInviteCode();

    fireEvent.change(screen.getByPlaceholderText(searchInputPlaceholder), {
      target: { value: "Alpha" },
    });
    fireEvent.click(screen.getByRole("button", { name: searchButtonLabel }));
    fireEvent.click(await screen.findByRole("button", { name: /Alpha Room/ }));

    expect(screen.getByRole("dialog", { name: registerDialogTitle })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: registerButtonLabel }));

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/dashboard");
    });

    const registerCall = fetchCallsFor("/api/registered-room").find(
      ([, init]) => init?.method === "PUT",
    );

    expect(registerCall?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          ...sampleRoom,
          inviteCode: "ABCD123456",
        }),
        method: "PUT",
      }),
    );
  });

  it("サーバーで無効と判定された招待コードにはエラーメッセージを表示する", async () => {
    setupFetchScenario({ inviteValid: false });

    await renderSearchPage();

    const inviteInput = screen.getByPlaceholderText("ABCD123456");
    fireEvent.change(inviteInput, { target: { value: "ABCD123456" } });
    fireEvent.click(screen.getByRole("button", { name: confirmButtonLabel }));

    expect(
      await screen.findByText("招待コードが正しくありません。残り3回入力できます。"),
    ).toBeDefined();
    expect(screen.getByRole("dialog", { name: inviteDialogTitle })).toBeDefined();
  });

  it("検索結果が0件の場合は空メッセージを表示する", async () => {
    setupFetchScenario({ rooms: [] });

    await renderSearchPage();
    await verifyInviteCode();

    fireEvent.change(screen.getByPlaceholderText(searchInputPlaceholder), {
      target: { value: "Unknown" },
    });
    fireEvent.click(screen.getByRole("button", { name: searchButtonLabel }));

    expect(
      await screen.findByText("該当するルームが見つかりませんでした。"),
    ).toBeDefined();
  });

  it("ルーム登録に失敗した場合はエラーダイアログを表示する", async () => {
    setupFetchScenario({ rooms: [sampleRoom], registerOk: false });

    await renderSearchPage();
    await verifyInviteCode();

    fireEvent.change(screen.getByPlaceholderText(searchInputPlaceholder), {
      target: { value: "Alpha" },
    });
    fireEvent.click(screen.getByRole("button", { name: searchButtonLabel }));
    fireEvent.click(await screen.findByRole("button", { name: /Alpha Room/ }));

    expect(screen.getByRole("dialog", { name: registerDialogTitle })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: registerButtonLabel }));

    expect(
      await screen.findByRole("dialog", { name: "登録できません" }),
    ).toBeDefined();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("locks invite-code entry after four invalid submissions", async () => {
    setupFetchScenario();

    await renderSearchPage();

    const inviteInput = screen.getByPlaceholderText("ABCD123456");
    fireEvent.change(inviteInput, { target: { value: "bad" } });

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: confirmButtonLabel }));
    }

    expect(await screen.findByText(lockedInviteMessage)).toBeDefined();
    expect((inviteInput as HTMLInputElement).disabled).toBe(true);
    expect(fetchCallsFor("/api/invitations/verify")).toHaveLength(0);
  });
});
