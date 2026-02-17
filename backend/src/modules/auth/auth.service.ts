import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { prisma } from "../../db/prisma";
import { redis } from "../../db/redis";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";

const refreshPrefix = "refresh";

type LoginInput = {
  email: string;
  password: string;
  deviceFingerprint: string;
  ipAddress: string;
};

type RefreshInput = {
  refreshToken: string;
  deviceFingerprint: string;
  ipAddress: string;
};

const refreshKey = (jti: string): string => `${refreshPrefix}:${jti}`;

export const authService = {
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user || !user.isActive) {
      throw new Error("Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new Error("Invalid credentials");
    }

    const jti = randomUUID();
    const refreshToken = signRefreshToken(user.id, jti);
    const accessToken = signAccessToken(user.id, user.role);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenJti: jti,
        deviceFingerprint: input.deviceFingerprint,
        ipAddress: input.ipAddress,
        expiresAt
      }
    });

    await redis.set(
      refreshKey(jti),
      JSON.stringify({
        userId: user.id,
        deviceFingerprint: input.deviceFingerprint,
        ipAddress: input.ipAddress
      }),
      "EX",
      60 * 60 * 24 * 14
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    };
  },

  async refresh(input: RefreshInput) {
    const payload = verifyRefreshToken(input.refreshToken);
    const key = refreshKey(payload.jti);
    const refreshRecordRaw = await redis.get(key);

    if (!refreshRecordRaw) {
      throw new Error("Refresh token expired or revoked");
    }

    const refreshRecord = JSON.parse(refreshRecordRaw) as {
      userId: string;
      deviceFingerprint: string;
      ipAddress: string;
    };

    if (
      refreshRecord.userId !== payload.sub ||
      refreshRecord.deviceFingerprint !== input.deviceFingerprint ||
      refreshRecord.ipAddress !== input.ipAddress
    ) {
      throw new Error("Refresh token context mismatch");
    }

    await redis.del(key);
    await prisma.refreshSession.updateMany({
      where: { tokenJti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new Error("User inactive");
    }

    const newJti = randomUUID();
    const newRefreshToken = signRefreshToken(user.id, newJti);
    const newAccessToken = signAccessToken(user.id, user.role);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenJti: newJti,
        deviceFingerprint: input.deviceFingerprint,
        ipAddress: input.ipAddress,
        expiresAt
      }
    });

    await redis.set(
      refreshKey(newJti),
      JSON.stringify({
        userId: user.id,
        deviceFingerprint: input.deviceFingerprint,
        ipAddress: input.ipAddress
      }),
      "EX",
      60 * 60 * 24 * 14
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  },

  async logout(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await redis.del(refreshKey(payload.jti));
      await prisma.refreshSession.updateMany({
        where: { tokenJti: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    } catch {
      // No-op to keep logout idempotent.
    }
  }
};
