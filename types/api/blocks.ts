export type BlockRequestBody = {
  blockedUserId?: unknown;
  blockedUserName?: unknown;
};

export type UserBlockData = {
  id: string;
  blockedUserId: string;
  blockedUserName: string;
  createdAt: Date;
  updatedAt: Date;
};
