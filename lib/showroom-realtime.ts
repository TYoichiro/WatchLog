export const SHOWROOM_SOCKET_URL = "wss://online.showroom-live.com/";
export const SHOWROOM_SOCKET_ACK_MESSAGE = "ACK\tshowroom";
export const SHOWROOM_SOCKET_PING_MESSAGE = "PING\tshowroom";
export const SHOWROOM_LIVE_STARTED_MESSAGE_TYPE = 104;

function toRealtimeMessageType(
  value: number | string | null | undefined
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function isLiveStartedSocketMessage(
  rawMessage: string,
  broadcastKey: string
): boolean {
  const jsonText = getShowroomSocketPayloadText(rawMessage, broadcastKey);

  if (!jsonText || !jsonText.startsWith("{")) {
    return false;
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return false;
    }

    return (
      toRealtimeMessageType((parsed as { t?: number | string | null }).t) ===
      SHOWROOM_LIVE_STARTED_MESSAGE_TYPE
    );
  } catch {
    return false;
  }
}

export function createShowroomSubscribeMessage(subscriptionKey: string): string {
  return `SUB\t${subscriptionKey}`;
}

export function getShowroomSocketPayloadText(
  rawMessage: string,
  subscriptionKey: string
): string | null {
  if (
    rawMessage === SHOWROOM_SOCKET_ACK_MESSAGE ||
    rawMessage === "Could not decode a text frame as UTF-8."
  ) {
    return null;
  }

  const expectedPrefix = `MSG\t${subscriptionKey}\t`;

  if (rawMessage.startsWith(expectedPrefix)) {
    return rawMessage.slice(expectedPrefix.length);
  }

  if (!rawMessage.startsWith("MSG\t")) {
    return null;
  }

  const jsonStartIndex = rawMessage.indexOf("{");

  return jsonStartIndex >= 0 ? rawMessage.slice(jsonStartIndex) : null;
}
