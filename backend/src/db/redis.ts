import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL as string;

if (!REDIS_URL) {
  console.warn("⚠️  REDIS_URL not set — Redis features will fail");
}

// Main client — general commands (get/set/etc)
export const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  tls: REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});

// Separate clients for pub/sub — Redis requires dedicated connections
// for subscribe mode (can't run other commands on a subscribed connection)
export const redisPublisher = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  tls: REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});

export const redisSubscriber = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  tls: REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});

redisClient.on("connect", () => console.log("✅ Redis client connected"));
redisClient.on("error", (err) => console.error("❌ Redis client error:", err));
