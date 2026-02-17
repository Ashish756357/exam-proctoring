import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../utils/types";
import { sessionsService } from "./sessions.service";

const startSchema = z.object({
  examId: z.string().min(6),
  deviceFingerprint: z.string().min(8),
  ipAddress: z.string().min(3)
});

const pairClaimSchema = z.object({
  pairingToken: z.string().min(10),
  deviceFingerprint: z.string().min(8)
});

const answerSchema = z.object({
  questionId: z.string().min(6),
  answerType: z.enum(["MCQ", "CODING", "SUBJECTIVE"]),
  responseJson: z.unknown(),
  latencyMs: z.number().int().nonnegative().optional()
});

const submitSchema = z.object({
  reason: z.enum(["USER_SUBMIT", "AUTO_SUBMIT"]).default("USER_SUBMIT")
});

const heartbeatSchema = z.object({
  role: z.enum(["candidate", "mobile"])
});

export const sessionsController = {
  async start(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const input = startSchema.parse(req.body);
    const session = await sessionsService.start({
      examId: input.examId,
      candidateId: req.auth.userId,
      deviceFingerprint: input.deviceFingerprint,
      ipAddress: input.ipAddress
    });

    res.status(201).json({
      sessionId: session.id,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      webrtcRoom: session.webrtcRoomId
    });
  },

  async createPairingToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const params = z.object({ sessionId: z.string().min(6) }).parse(req.params);
    const token = await sessionsService.createPairingToken(params.sessionId, req.auth.userId);

    res.status(200).json(token);
  },

  async claimPairing(req: AuthenticatedRequest, res: Response): Promise<void> {
    const input = pairClaimSchema.parse(req.body);
    const output = await sessionsService.claimPairingToken(input.pairingToken, input.deviceFingerprint);

    res.status(200).json(output);
  },

  async saveAnswer(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const params = z.object({ sessionId: z.string().min(6) }).parse(req.params);
    const input = answerSchema.parse(req.body);

    const output = await sessionsService.saveAnswer({
      sessionId: params.sessionId,
      candidateId: req.auth.userId,
      questionId: input.questionId,
      answerType: input.answerType,
      responseJson: input.responseJson,
      latencyMs: input.latencyMs
    });

    res.status(200).json(output);
  },

  async submit(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const params = z.object({ sessionId: z.string().min(6) }).parse(req.params);
    const body = submitSchema.parse(req.body);

    const output = await sessionsService.submit(params.sessionId, req.auth.userId, body.reason);
    res.status(200).json(output);
  },

  async heartbeat(req: AuthenticatedRequest, res: Response): Promise<void> {
    const params = z.object({ sessionId: z.string().min(6) }).parse(req.params);
    const body = heartbeatSchema.parse(req.body);

    await sessionsService.heartbeat(params.sessionId, body.role);
    res.status(200).json({ ok: true });
  }
};
