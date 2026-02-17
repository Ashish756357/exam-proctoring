import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

export const connectRedis = async (): Promise<void> => {
  if (redis.status === "ready") {
    return;
  }

  await redis.connect();
};
