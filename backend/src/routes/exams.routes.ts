import { Router } from "express";
import { Role } from "@prisma/client";
import { examsController } from "../modules/exams/exams.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const examsRouter = Router();

examsRouter.get("/assigned", requireAuth, requireRole([Role.CANDIDATE]), (req, res, next) => {
  examsController.getAssigned(req, res).catch(next);
});

examsRouter.post("/", requireAuth, requireRole([Role.ADMIN]), (req, res, next) => {
  examsController.create(req, res).catch(next);
});

examsRouter.get("/:examId", requireAuth, (req, res, next) => {
  examsController.getById(req, res).catch(next);
});
