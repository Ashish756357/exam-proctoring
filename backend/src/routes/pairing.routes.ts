import { Router } from "express";
import { sessionsController } from "../modules/sessions/sessions.controller";

export const pairingRouter = Router();

pairingRouter.post("/claim", (req, res, next) => {
  sessionsController.claimPairing(req, res).catch(next);
});
