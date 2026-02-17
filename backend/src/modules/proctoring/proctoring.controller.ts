import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../utils/types";
import { proctoringService } from "./proctoring.service";

const eventSchema = z.object({
  sessionId: z.string().min(6),
  source: z.enum(["LAPTOP", "MOBILE", "SYSTEM"]),
  eventType: z.string().min(3),
  severity: z.number().min(1).max(10),
  timestamp: z.string().datetime(),
  meta: z.record(z.unknown()).optional()
});

export const proctoringController = {
  async ingest(req: AuthenticatedRequest, res: Response): Promise<void> {
    const input = eventSchema.parse(req.body);

    if (req.mobileAuth && req.mobileAuth.sessionId !== input.sessionId) {
      res.status(403).json({ message: "Mobile token/session mismatch" });
      return;
    }

    if (req.mobileAuth && input.source !== "MOBILE") {
      res.status(403).json({ message: "Mobile token can only emit MOBILE source events" });
      return;
    }

    const output = await proctoringService.ingestEvent(input);
    res.status(201).json(output);
  },

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const params = z.object({ sessionId: z.string().min(6) }).parse(req.params);
    const events = await proctoringService.listBySession(params.sessionId);
    res.status(200).json({ items: events });
  }
};
