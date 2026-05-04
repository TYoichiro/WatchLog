type ShowroomUserIdentifiable = {
  userId?: string | null;
};

export function isBlockedShowroomUser(
  blockedUserIds: ReadonlySet<string>,
  userId: string | null | undefined
): boolean {
  return userId ? blockedUserIds.has(userId) : false;
}

export function filterBlockedShowroomItems<T extends ShowroomUserIdentifiable>(
  items: readonly T[],
  blockedUserIds: ReadonlySet<string>
): T[] {
  if (blockedUserIds.size === 0) {
    return [...items];
  }

  return items.filter(
    (item) => !isBlockedShowroomUser(blockedUserIds, item.userId)
  );
}
