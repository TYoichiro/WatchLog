/**
 * 配信ログから「振り返りサマリー」を集計する純粋関数群。
 *
 * 入力はオンライブ画面で扱う CommentRow / RoomGiftLog と構造的に互換な
 * 最小フィールドのみを要求する。UI から切り離してテスト可能にするため、
 * ここでは React や Prisma に依存しない。
 */

export type SummaryCommentInput = {
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  notice: boolean;
  telop: boolean;
  noticeTone: string | null;
};

export type SummaryGiftInput = {
  userId: string | null;
  userName: string;
  avatarUrl: string | null;
  count: number;
  isFree: boolean | null;
  point: number | null;
  totalPoint: number | null;
};

export type SummaryGiftTotals = {
  freePoints: number;
  paidPoints: number;
  totalPoints: number;
};

export type OnliveSummaryInput = {
  comments: readonly SummaryCommentInput[];
  gifts: readonly SummaryGiftInput[];
  giftTotals: SummaryGiftTotals;
  followerStart: number | null;
  followerEnd: number | null;
  startedAt: number | null;
  endedAt: number | null;
};

export type SummaryRankedUser = {
  userId: string | null;
  userName: string;
  avatarUrl: string | null;
  value: number;
};

export type OnliveSummary = {
  durationSeconds: number | null;
  startedAt: number | null;
  endedAt: number | null;
  totalPoints: number;
  paidPoints: number;
  freePoints: number;
  followerStart: number | null;
  followerEnd: number | null;
  followerGain: number | null;
  newFollowerCount: number;
  firstVisitCount: number;
  commentCount: number;
  commenterCount: number;
  giftCount: number;
  gifterCount: number;
  topGifters: SummaryRankedUser[];
  topCommenters: SummaryRankedUser[];
};

export type SummaryDelta = {
  current: number;
  previous: number;
  delta: number;
};

export type OnliveSummaryComparison = {
  totalPoints: SummaryDelta;
  paidPoints: SummaryDelta;
  freePoints: SummaryDelta;
  followerGain: SummaryDelta;
  newFollowerCount: SummaryDelta;
  commentCount: SummaryDelta;
  commenterCount: SummaryDelta;
  giftCount: SummaryDelta;
  gifterCount: SummaryDelta;
  durationSeconds: SummaryDelta;
};

const TOP_RANKING_LIMIT = 5;

function isFreeGift(gift: SummaryGiftInput): boolean {
  return gift.isFree === true;
}

/**
 * ギフト1件分の獲得ポイントを推定する。
 * オンライブ画面の集計ロジック（getGiftSummaryPoint）と同等の扱い。
 */
function getGiftPoint(gift: SummaryGiftInput): number {
  if (typeof gift.totalPoint === "number") {
    return gift.totalPoint;
  }

  if (isFreeGift(gift)) {
    const unit = gift.point === 0 || gift.point === null ? 1 : gift.point;
    return unit * gift.count;
  }

  if (typeof gift.point === "number" && gift.point > 0) {
    return gift.point * gift.count;
  }

  return 0;
}

function rankByValue(
  entries: Map<string, SummaryRankedUser>
): SummaryRankedUser[] {
  return Array.from(entries.values())
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_RANKING_LIMIT);
}

export function computeOnliveSummary(
  input: OnliveSummaryInput
): OnliveSummary {
  const followerStart = input.followerStart;
  const followerEnd = input.followerEnd;
  const followerGain =
    followerStart !== null && followerEnd !== null
      ? followerEnd - followerStart
      : null;

  let newFollowerCount = 0;
  let firstVisitCount = 0;
  const commenters = new Map<string, SummaryRankedUser>();

  for (const comment of input.comments) {
    if (comment.notice) {
      if (comment.noticeTone === "follow") {
        newFollowerCount += 1;
      } else if (comment.noticeTone === "firstVisit") {
        firstVisitCount += 1;
      }
      continue;
    }

    if (comment.telop) {
      continue;
    }

    const key = comment.userId ?? `name:${comment.name}`;
    const existing = commenters.get(key);

    if (existing) {
      existing.value += 1;
    } else {
      commenters.set(key, {
        userId: comment.userId,
        userName: comment.name,
        avatarUrl: comment.avatarUrl,
        value: 1,
      });
    }
  }

  const gifters = new Map<string, SummaryRankedUser>();

  for (const gift of input.gifts) {
    const point = getGiftPoint(gift);
    const key = gift.userId ?? `name:${gift.userName}`;
    const existing = gifters.get(key);

    if (existing) {
      existing.value += point;
    } else {
      gifters.set(key, {
        userId: gift.userId,
        userName: gift.userName,
        avatarUrl: gift.avatarUrl,
        value: point,
      });
    }
  }

  const commentCount = Array.from(commenters.values()).reduce(
    (total, entry) => total + entry.value,
    0
  );

  const durationSeconds =
    input.startedAt !== null && input.endedAt !== null
      ? Math.max(0, input.endedAt - input.startedAt)
      : null;

  return {
    durationSeconds,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    totalPoints: input.giftTotals.totalPoints,
    paidPoints: input.giftTotals.paidPoints,
    freePoints: input.giftTotals.freePoints,
    followerStart,
    followerEnd,
    followerGain,
    newFollowerCount,
    firstVisitCount,
    commentCount,
    commenterCount: commenters.size,
    giftCount: input.gifts.length,
    gifterCount: gifters.size,
    topGifters: rankByValue(gifters),
    topCommenters: rankByValue(commenters),
  };
}

function toDelta(current: number, previous: number): SummaryDelta {
  return {
    current,
    previous,
    delta: current - previous,
  };
}

export function compareOnliveSummaries(
  current: OnliveSummary,
  previous: OnliveSummary
): OnliveSummaryComparison {
  return {
    totalPoints: toDelta(current.totalPoints, previous.totalPoints),
    paidPoints: toDelta(current.paidPoints, previous.paidPoints),
    freePoints: toDelta(current.freePoints, previous.freePoints),
    followerGain: toDelta(current.followerGain ?? 0, previous.followerGain ?? 0),
    newFollowerCount: toDelta(
      current.newFollowerCount,
      previous.newFollowerCount
    ),
    commentCount: toDelta(current.commentCount, previous.commentCount),
    commenterCount: toDelta(current.commenterCount, previous.commenterCount),
    giftCount: toDelta(current.giftCount, previous.giftCount),
    gifterCount: toDelta(current.gifterCount, previous.gifterCount),
    durationSeconds: toDelta(
      current.durationSeconds ?? 0,
      previous.durationSeconds ?? 0
    ),
  };
}
