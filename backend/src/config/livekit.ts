import { AccessToken } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

export const videoEnabled = Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);

if (!videoEnabled) {
  console.warn(
    "⚠️  LiveKit not configured (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing) — video call endpoints will return 503."
  );
}

/**
 * One LiveKit "room" per match — matchId doubles as the room name so there's
 * never more than 2 participants unless we explicitly add group calls later.
 */
export function roomNameForMatch(matchId: string): string {
  return `match-${matchId}`;
}

/**
 * Generates a short-lived (10 min) join token scoped to exactly one room.
 * The identity is the userId so we can tell participants apart on the client,
 * and so LiveKit webhooks (if added later) can be tied back to a user.
 */
export async function createVideoToken(params: {
  userId: string;
  displayName: string;
  matchId: string;
}): Promise<{ token: string; url: string; roomName: string }> {
  const roomName = roomNameForMatch(params.matchId);

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: params.userId,
    name: params.displayName,
    ttl: "10m",
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Hard cap at 2 participants per room — this is 1-on-1 dating video chat,
    // not group calls. Prevents a stale token being reused to eavesdrop.
    roomCreate: true,
  });

  const token = await at.toJwt();
  return { token, url: LIVEKIT_URL, roomName };
}
