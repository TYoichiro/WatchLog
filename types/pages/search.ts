export type RoomResult = {
  imageUrl: string;
  roomId: string;
  roomName: string;
  roomUrl: string;
};

export type SearchResponse = {
  rooms?: RoomResult[];
};

export type InvitationVerificationResponse = {
  valid?: boolean;
  banned?: boolean;
  remainingAttempts?: number;
};
