export type RegisteredRoom = {
  imageUrl: string | null;
  roomId: string;
  roomName: string | null;
  roomUrl: string;
};

type RegisteredRoomResponse = {
  error?: string;
  room?: RegisteredRoom | null;
};

type SaveRegisteredRoomInput = {
  imageUrl?: string | null;
  inviteCode: string;
  roomId: string;
  roomName?: string | null;
  roomUrl: string;
};

export async function fetchRegisteredRoom(
  signal?: AbortSignal
): Promise<RegisteredRoom | null> {
  const response = await fetch("/api/registered-room", {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch registered room");
  }

  const data = (await response.json()) as RegisteredRoomResponse;
  return data.room ?? null;
}

export async function saveRegisteredRoom(
  room: SaveRegisteredRoomInput
): Promise<RegisteredRoom> {
  const response = await fetch("/api/registered-room", {
    body: JSON.stringify(room),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  if (!response.ok) {
    let message = "Failed to save registered room";

    try {
      const data = (await response.json()) as RegisteredRoomResponse;
      message = data.error ?? message;
    } catch {
      // Keep the default message when the server did not return JSON.
    }

    throw new Error(message);
  }

  const data = (await response.json()) as RegisteredRoomResponse;

  if (!data.room) {
    throw new Error("Registered room response is empty");
  }

  return data.room;
}
