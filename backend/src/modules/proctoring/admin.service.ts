import { ReviewDecision } from "@prisma/client";
import { prisma } from "../../db/prisma";

export const adminService = {
  async listLiveSessions() {
    return prisma.session.findMany({
      where: {
        status: {
          in: ["STARTED"]
        }
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        exam: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: {
        startedAt: "asc"
      }
    });
  },

  async decideSession(sessionId: string, actorId: string, decision: ReviewDecision, reason: string) {
    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        reviewDecision: decision
      }
    });

    await prisma.adminAction.create({
      data: {
        sessionId,
        actorId,
        actionType: "SESSION_DECISION",
        reason,
        payloadJson: {
          decision
        }
      }
    });

    return updated;
  }
};
