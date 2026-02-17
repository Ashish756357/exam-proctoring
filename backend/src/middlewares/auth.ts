import { NextFunction, Response } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken, verifyMobileToken } from "../utils/jwt";
import { AuthenticatedRequest } from "../utils/types";

const bearerPrefix = "Bearer ";

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.header("authorization");

  if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  const token = authHeader.slice(bearerPrefix.length);

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: "Invalid access token" });
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
};

export const requireAccessOrMobile = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.header("authorization");

  if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  const token = authHeader.slice(bearerPrefix.length);

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role };
    next();
    return;
  } catch {
    // Access token failed, try mobile token.
  }

  try {
    const mobilePayload = verifyMobileToken(token);
    req.mobileAuth = { sessionId: mobilePayload.sessionId };
    next();
    return;
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
