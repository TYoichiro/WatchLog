import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./use-mobile";

const MOBILE_BREAKPOINT = 768;

function createMatchMediaMock() {
  const listeners: Array<() => void> = [];

  const mql = {
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === "change") listeners.push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: () => void) => {
      const index = listeners.indexOf(handler);
      if (index !== -1) listeners.splice(index, 1);
    }),
    triggerChange: () => {
      listeners.forEach((fn) => fn());
    },
  };

  const matchMediaFn = vi.fn().mockReturnValue(mql);
  return { matchMediaFn, mql };
}

function setInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("useIsMobile", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    setInnerWidth(1024);
  });

  it("ウィンドウ幅がモバイルブレークポイント未満のとき true を返す", () => {
    const { matchMediaFn } = createMatchMediaMock();
    vi.stubGlobal("matchMedia", matchMediaFn);
    setInnerWidth(375);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("ウィンドウ幅がモバイルブレークポイント以上のとき false を返す", () => {
    const { matchMediaFn } = createMatchMediaMock();
    vi.stubGlobal("matchMedia", matchMediaFn);
    setInnerWidth(1024);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it("ウィンドウ幅がちょうど 768 のとき false を返す", () => {
    const { matchMediaFn } = createMatchMediaMock();
    vi.stubGlobal("matchMedia", matchMediaFn);
    setInnerWidth(MOBILE_BREAKPOINT);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it("ウィンドウ幅が 767 のとき true を返す", () => {
    const { matchMediaFn } = createMatchMediaMock();
    vi.stubGlobal("matchMedia", matchMediaFn);
    setInnerWidth(MOBILE_BREAKPOINT - 1);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("matchMedia の change イベントでモバイルに切り替わる", () => {
    const { matchMediaFn, mql } = createMatchMediaMock();
    vi.stubGlobal("matchMedia", matchMediaFn);
    setInnerWidth(1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setInnerWidth(375);
    act(() => {
      mql.triggerChange();
    });

    expect(result.current).toBe(true);
  });

  it("matchMedia の change イベントでデスクトップに切り替わる", () => {
    const { matchMediaFn, mql } = createMatchMediaMock();
    vi.stubGlobal("matchMedia", matchMediaFn);
    setInnerWidth(375);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    setInnerWidth(1280);
    act(() => {
      mql.triggerChange();
    });

    expect(result.current).toBe(false);
  });

  it("アンマウント時にイベントリスナーが削除される", () => {
    const { matchMediaFn, mql } = createMatchMediaMock();
    vi.stubGlobal("matchMedia", matchMediaFn);

    const { unmount } = renderHook(() => useIsMobile());

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("addEventListener と removeEventListener に同じ関数が渡される", () => {
    const { matchMediaFn, mql } = createMatchMediaMock();
    vi.stubGlobal("matchMedia", matchMediaFn);

    const { unmount } = renderHook(() => useIsMobile());

    const addedHandler = (mql.addEventListener.mock.calls[0] as [string, () => void])[1];
    unmount();
    const removedHandler = (mql.removeEventListener.mock.calls[0] as [string, () => void])[1];

    expect(addedHandler).toBe(removedHandler);
  });

  it("matchMedia が正しいクエリ文字列で呼ばれる", () => {
    const { matchMediaFn } = createMatchMediaMock();
    vi.stubGlobal("matchMedia", matchMediaFn);

    renderHook(() => useIsMobile());

    expect(matchMediaFn).toHaveBeenCalledWith(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );
  });
});
