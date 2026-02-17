import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAccessOrMobile, requireAuth, requireRole } from "../middlewares/auth";
import { eventRateLimiter } from "../middlewares/rateLimit";
import { proctoringController } from "../modules/proctoring/proctoring.controller";

export const proctoringRouter = Router();

proctoringRouter.post("/events", requireAccessOrMobile, eventRateLimiter, (req, res, next) => {
  proctoringController.ingest(req, res).catch(next);
});

proctoringRouter.get("/sessions/:sessionId/events", requireAuth, requireRole([Role.ADMIN, Role.PROCTOR]), (req, res, next) => {
  proctoringController.list(req, res).catch(next);
});
