import { Response } from "express";
import { z } from "zod";
import { examsService } from "./exams.service";
import { AuthenticatedRequest } from "../../utils/types";

const createExamSchema = z.object({
  title: z.string().min(3),
  instructions: z.string().min(3),
  durationMinutes: z.number().int().positive(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  randomizeQuestions: z.boolean().default(true),
  questions: z.array(
    z.object({
      type: z.enum(["MCQ", "CODING", "SUBJECTIVE"]),
      prompt: z.string().min(2),
      optionsJson: z.unknown().optional(),
      answerKeyJson: z.unknown().optional(),
      points: z.number().int().positive()
    })
  )
});

export const examsController = {
  async getAssigned(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const exams = await examsService.getAssigned(req.auth.userId);
    res.status(200).json({ items: exams });
  },

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const input = createExamSchema.parse(req.body);
    const exam = await examsService.createExam(req.auth.userId, input);
    res.status(201).json(exam);
  },

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const params = z.object({ examId: z.string().min(6) }).parse(req.params);
    const exam = await examsService.getExamForCandidate(params.examId, req.auth.userId);
    res.status(200).json(exam);
  }
};
