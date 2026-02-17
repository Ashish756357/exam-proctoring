import dotenv from "dotenv";

dotenv.config();

const required = [
  "DATABASE_URL",
  "MONGO_URL",
  "REDIS_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_MOBILE_SECRET"
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: toNumber(process.env.PORT, 8080),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174,http://localhost:5175")
    .split(",")
    .map((origin) => origin.trim()),

  databaseUrl: process.env.DATABASE_URL as string,
  mongoUrl: process.env.MONGO_URL as string,
  redisUrl: process.env.REDIS_URL as string,

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET as string,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET as string,
  jwtMobileSecret: process.env.JWT_MOBILE_SECRET as string,
  accessTokenTtlSeconds: toNumber(process.env.ACCESS_TOKEN_TTL_SECONDS, 900),
  refreshTokenTtlSeconds: toNumber(process.env.REFRESH_TOKEN_TTL_SECONDS, 60 * 60 * 24 * 14),

  pairingTokenTtlSeconds: toNumber(process.env.PAIRING_TOKEN_TTL_SECONDS, 300),
  sessionHeartbeatTimeoutSeconds: toNumber(process.env.SESSION_HEARTBEAT_TIMEOUT_SECONDS, 20),
  violationAutoSubmitThreshold: toNumber(process.env.VIOLATION_AUTOSUBMIT_THRESHOLD, 100),

  aiEngineUrl: process.env.AI_ENGINE_URL ?? "http://localhost:8090",
  mobileAppBaseUrl: stripTrailingSlash(process.env.MOBILE_APP_BASE_URL ?? "http://localhost:5174"),
  encryptionKeyHex:
    process.env.ENCRYPTION_KEY_HEX ?? "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
};
