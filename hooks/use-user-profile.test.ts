import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUserProfile } from "./use-user-profile";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("useUserProfile", () => {
  const roomId = "12345";
  const userId = "user-99";
  const userName = "Test User";

  const mockProfile = { name: "Test User Full Name" };

  it("初期状態は target=null で profile=null", () => {
    const { result } = renderHook(() => useUserProfile(roomId));

    expect(result.current.target).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it("openProfile を呼ぶと target がセットされる", () => {
    const { result } = renderHook(() => useUserProfile(roomId));

    act(() => {
      result.current.openProfile(userId, userName);
    });

    expect(result.current.target).toEqual({ userId, userName });
  });

  it("openProfile 後にプロフィールをフェッチする", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ profile: mockProfile }));

    const { result } = renderHook(() => useUserProfile(roomId));

    act(() => {
      result.current.openProfile(userId, userName);
    });

    await waitFor(() => {
      expect(result.current.profile).toEqual(mockProfile);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/room/user-profile?room_id=${roomId}&user_id=${userId}`,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it("フェッチ中は isLoading が true になる", async () => {
    let resolveRequest!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { result } = renderHook(() => useUserProfile(roomId));

    act(() => {
      result.current.openProfile(userId, userName);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    resolveRequest(jsonResponse({ profile: mockProfile }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("フェッチ失敗時は hasError が true になる", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Not found" }, { status: 404 }),
    );

    const { result } = renderHook(() => useUserProfile(roomId));

    act(() => {
      result.current.openProfile(userId, userName);
    });

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("同じユーザーは2回フェッチしない（キャッシュ）", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ profile: mockProfile }));

    const { result } = renderHook(() => useUserProfile(roomId));

    act(() => {
      result.current.openProfile(userId, userName);
    });

    await waitFor(() => {
      expect(result.current.profile).toEqual(mockProfile);
    });

    act(() => {
      result.current.closeProfile();
    });

    act(() => {
      result.current.openProfile(userId, userName);
    });

    await waitFor(() => {
      expect(result.current.profile).toEqual(mockProfile);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("closeProfile を呼ぶと target が null に戻る", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ profile: mockProfile }));

    const { result } = renderHook(() => useUserProfile(roomId));

    act(() => {
      result.current.openProfile(userId, userName);
    });

    await waitFor(() => expect(result.current.profile).toEqual(mockProfile));

    act(() => {
      result.current.closeProfile();
    });

    expect(result.current.target).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it("初期の view は 'user'", () => {
    const { result } = renderHook(() => useUserProfile(roomId));
    expect(result.current.view).toBe("user");
  });

  it("setView で view が切り替わる", () => {
    const { result } = renderHook(() => useUserProfile(roomId));

    act(() => {
      result.current.setView("room");
    });

    expect(result.current.view).toBe("room");
  });

  it("closeProfile を呼ぶと view が 'user' に戻る", () => {
    const { result } = renderHook(() => useUserProfile(roomId));

    act(() => {
      result.current.setView("room");
    });

    act(() => {
      result.current.closeProfile();
    });

    expect(result.current.view).toBe("user");
  });

  it("openProfile を呼ぶと hasError がリセットされる", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "fail" }, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ profile: mockProfile }));

    const { result } = renderHook(() => useUserProfile(roomId));

    act(() => {
      result.current.openProfile(userId, userName);
    });

    await waitFor(() => expect(result.current.hasError).toBe(true));

    const otherUserId = "user-100";
    act(() => {
      result.current.openProfile(otherUserId, "Other User");
    });

    expect(result.current.hasError).toBe(false);
  });
});
