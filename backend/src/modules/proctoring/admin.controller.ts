import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../utils/types";
import { adminService } from "./admin.service";

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().min(3)
});

export const adminController = {
  async listLiveSessions(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const items = await adminService.listLiveSessions();
    res.status(200).json({ items });
  },

  async decide(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.auth) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const params = z.object({ sessionId: z.string().min(6) }).parse(req.params);
    const body = decisionSchema.parse(req.body);

    const updated = await adminService.decideSession(
      params.sessionId,
      req.auth.userId,
      body.decision,
      body.reason
    );

    res.status(200).json({
      sessionId: updated.id,
      decision: updated.reviewDecision,
      decidedBy: req.auth.userId,
      decidedAt: new Date().toISOString()
    });
  }
};
