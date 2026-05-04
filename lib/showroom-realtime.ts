export const SHOWROOM_SOCKET_URL = "wss://online.showroom-live.com/";
export const SHOWROOM_SOCKET_ACK_MESSAGE = "ACK\tshowroom";
export const SHOWROOM_SOCKET_PING_MESSAGE = "PING\tshowroom";
export const SHOWROOM_LIVE_STARTED_MESSAGE_TYPE = 104;

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
