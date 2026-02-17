import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middlewares/auth";
import { adminController } from "../modules/proctoring/admin.controller";

export const adminRouter = Router();

adminRouter.get("/sessions/live", requireAuth, requireRole([Role.ADMIN, Role.PROCTOR]), (req, res, next) => {
  adminController.listLiveSessions(req, res).catch(next);
});

adminRouter.post(
  "/sessions/:sessionId/decision",
  requireAuth,
  requireRole([Role.ADMIN, Role.PROCTOR]),
  (req, res, next) => {
    adminController.decide(req, res).catch(next);
  }
);
