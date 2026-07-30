import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL as string;

if (!REDIS_URL) {
  console.warn("⚠️  REDIS_URL not set — Redis features will fail");
}

// Shared config — Upstash free tier drops idle TCP connections, so we need
// a retry strategy that reconnects gracefully instead of crashing/spamming logs.
const sharedOptions = {
  maxRetriesPerRequest: 3,
  tls: REDIS_URL?.startsWith("rediss://") ? {} : undefined,
  retryStrategy(times: number) {
    // Backoff: 200ms, 400ms, 800ms... capped at 5s
    return Math.min(times * 200, 5000);
  },
  reconnectOnError() {
    // Reconnect automatically on any connection-level error (e.g. ECONNRESET)
    return true;
  },
};

// Main client — general commands (get/set/etc)
export const redisClient = new Redis(REDIS_URL, sharedOptions);

// Separate clients for pub/sub — Redis requires dedicated connections
// for subscribe mode (can't run other commands on a subscribed connection)
export const redisPublisher = new Redis(REDIS_URL, sharedOptions);
export const redisSubscriber = new Redis(REDIS_URL, sharedOptions);

// Attach connect/error listeners to all three so ioredis never throws an
// "Unhandled error event" — it just logs and lets retryStrategy reconnect.
for (const [name, client] of [
  ["client", redisClient],
  ["publisher", redisPublisher],
  ["subscriber", redisSubscriber],
] as const) {
  client.on("connect", () => console.log(`✅ Redis ${name} connected`));
  client.on("error", (err) => console.error(`❌ Redis ${name} error:`, err.message));
}
