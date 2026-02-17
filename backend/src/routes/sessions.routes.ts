import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middlewares/auth";
import { sessionsController } from "../modules/sessions/sessions.controller";

export const sessionsRouter = Router();

sessionsRouter.post("/start", requireAuth, requireRole([Role.CANDIDATE]), (req, res, next) => {
  sessionsController.start(req, res).catch(next);
});

sessionsRouter.post("/:sessionId/pairing-token", requireAuth, requireRole([Role.CANDIDATE]), (req, res, next) => {
  sessionsController.createPairingToken(req, res).catch(next);
});

sessionsRouter.post("/pairing/claim", (req, res, next) => {
  sessionsController.claimPairing(req, res).catch(next);
});

sessionsRouter.post("/:sessionId/answers", requireAuth, requireRole([Role.CANDIDATE]), (req, res, next) => {
  sessionsController.saveAnswer(req, res).catch(next);
});

sessionsRouter.post("/:sessionId/submit", requireAuth, requireRole([Role.CANDIDATE]), (req, res, next) => {
  sessionsController.submit(req, res).catch(next);
});

sessionsRouter.post("/:sessionId/heartbeat", requireAuth, (req, res, next) => {
  sessionsController.heartbeat(req, res).catch(next);
});
