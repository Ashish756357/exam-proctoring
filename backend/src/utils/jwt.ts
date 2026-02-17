import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";

export type AccessTokenPayload = {
  sub: string;
  role: Role;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
  type: "refresh";
};

export type MobileTokenPayload = {
  sessionId: string;
  type: "mobile";
};

export const signAccessToken = (userId: string, role: Role): string => {
  const payload: AccessTokenPayload = {
    sub: userId,
    role,
    type: "access"
  };

  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtlSeconds
  });
};

export const signRefreshToken = (userId: string, jti: string): string => {
  const payload: RefreshTokenPayload = {
    sub: userId,
    jti,
    type: "refresh"
  };

  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenTtlSeconds
  });
};

export const signMobileToken = (sessionId: string): string => {
  const payload: MobileTokenPayload = {
    sessionId,
    type: "mobile"
  };

  return jwt.sign(payload, env.jwtMobileSecret, {
    expiresIn: "2h"
  });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
};

export const verifyMobileToken = (token: string): MobileTokenPayload => {
  return jwt.verify(token, env.jwtMobileSecret) as MobileTokenPayload;
};
