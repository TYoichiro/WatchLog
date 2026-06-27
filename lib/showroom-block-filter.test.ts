import { describe, expect, it } from "vitest";

import {
  filterBlockedShowroomItems,
  isBlockedShowroomUser,
} from "./showroom-block-filter";

describe("isBlockedShowroomUser", () => {
  const blocked = new Set(["user-1", "user-2"]);

  it("ブロックリストに含まれる userId は true を返す", () => {
    expect(isBlockedShowroomUser(blocked, "user-1")).toBe(true);
    expect(isBlockedShowroomUser(blocked, "user-2")).toBe(true);
  });

  it("ブロックリストに含まれない userId は false を返す", () => {
    expect(isBlockedShowroomUser(blocked, "user-3")).toBe(false);
  });

  it("userId が null の場合は false を返す", () => {
    expect(isBlockedShowroomUser(blocked, null)).toBe(false);
  });

  it("userId が undefined の場合は false を返す", () => {
    expect(isBlockedShowroomUser(blocked, undefined)).toBe(false);
  });

  it("空のブロックリストは常に false を返す", () => {
    expect(isBlockedShowroomUser(new Set(), "user-1")).toBe(false);
  });
});

describe("filterBlockedShowroomItems", () => {
  const blocked = new Set(["user-1", "user-3"]);

  it("ブロックされたユーザーのアイテムを除外する", () => {
    const items = [
      { userId: "user-1", name: "A" },
      { userId: "user-2", name: "B" },
      { userId: "user-3", name: "C" },
    ];
    const result = filterBlockedShowroomItems(items, blocked);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("B");
  });

  it("ブロックリストが空の場合はすべてのアイテムを返す", () => {
    const items = [
      { userId: "user-1", name: "A" },
      { userId: "user-2", name: "B" },
    ];
    const result = filterBlockedShowroomItems(items, new Set());
    expect(result).toHaveLength(2);
  });

  it("userId が null のアイテムは除外しない", () => {
    const items = [{ userId: null, name: "anonymous" }];
    const result = filterBlockedShowroomItems(items, blocked);
    expect(result).toHaveLength(1);
  });

  it("userId が undefined のアイテムは除外しない", () => {
    const items = [{ name: "no-id" }];
    const result = filterBlockedShowroomItems(items, blocked);
    expect(result).toHaveLength(1);
  });

  it("空配列を渡すと空配列を返す", () => {
    expect(filterBlockedShowroomItems([], blocked)).toHaveLength(0);
  });

  it("元の配列とは別の配列を返す", () => {
    const items = [{ userId: "user-2", name: "B" }];
    const result = filterBlockedShowroomItems(items, blocked);
    expect(result).not.toBe(items);
  });

  it("全員ブロック済みの場合は空配列を返す", () => {
    const items = [
      { userId: "user-1", name: "A" },
      { userId: "user-3", name: "C" },
    ];
    const result = filterBlockedShowroomItems(items, blocked);
    expect(result).toHaveLength(0);
  });
});
