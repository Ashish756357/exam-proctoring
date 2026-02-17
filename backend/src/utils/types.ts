import { Request } from "express";
import { Role } from "@prisma/client";

export type AuthContext = {
  userId: string;
  role: Role;
};

export type MobileAuthContext = {
  sessionId: string;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthContext;
  mobileAuth?: MobileAuthContext;
};
