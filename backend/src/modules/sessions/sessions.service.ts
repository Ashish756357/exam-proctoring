import { QuestionType, SessionStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../../db/prisma";
import { redis } from "../../db/redis";
import { env } from "../../config/env";
import { signMobileToken } from "../../utils/jwt";

const pairingPrefix = "pairing";

const pairingKey = (token: string): string => `${pairingPrefix}:${token}`;

type StartSessionInput = {
  examId: string;
  candidateId: string;
  deviceFingerprint: string;
  ipAddress: string;
};

type SaveAnswerInput = {
  sessionId: string;
  candidateId: string;
  questionId: string;
  answerType: QuestionType;
  responseJson: unknown;
  latencyMs?: number;
};

export const sessionsService = {
  async start(input: StartSessionInput) {
    const assignment = await prisma.examAssignment.findFirst({
      where: {
        examId: input.examId,
        candidateId: input.candidateId
      },
      include: {
        exam: true
      }
    });

    if (!assignment) {
      throw new Error("Exam not assigned");
    }

    const now = new Date();
    if (assignment.exam.startsAt > now || assignment.exam.endsAt < now) {
      throw new Error("Exam not active");
    }

    const existingActive = await prisma.session.findFirst({
      where: {
        examId: input.examId,
        candidateId: input.candidateId,
        status: "STARTED"
      }
    });

    if (existingActive) {
      return existingActive;
    }

    const expiresAt = new Date(now.getTime() + assignment.exam.durationMinutes * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        examId: input.examId,
        candidateId: input.candidateId,
        expiresAt,
        deviceFingerprint: input.deviceFingerprint,
        ipAddress: input.ipAddress,
        webrtcRoomId: "pending"
      }
    });

    return prisma.session.update({
      where: { id: session.id },
      data: { webrtcRoomId: session.id }
    });
  },

  async createPairingToken(sessionId: string, candidateId: string) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.candidateId !== candidateId) {
      throw new Error("Session not found");
    }

    if (session.status !== SessionStatus.STARTED) {
      throw new Error("Session not active");
    }

    const token = randomUUID();

    await redis.set(
      pairingKey(token),
      JSON.stringify({
        sessionId,
        candidateId
      }),
      "EX",
      env.pairingTokenTtlSeconds
    );

    return {
      pairingToken: token,
      expiresInSeconds: env.pairingTokenTtlSeconds,
      pairingUrl: `${env.mobileAppBaseUrl}/pair?token=${encodeURIComponent(token)}`
    };
  },

  async claimPairingToken(pairingToken: string, deviceFingerprint: string) {
    const raw = await redis.get(pairingKey(pairingToken));
    if (!raw) {
      throw new Error("Invalid or expired pairing token");
    }

    await redis.del(pairingKey(pairingToken));

    const parsed = JSON.parse(raw) as { sessionId: string; candidateId: string };

    await prisma.session.update({
      where: { id: parsed.sessionId },
      data: {
        mobilePairedAt: new Date()
      }
    });

    await redis.set(
      `mobile-device:${parsed.sessionId}`,
      JSON.stringify({ deviceFingerprint }),
      "EX",
      60 * 60 * 4
    );

    return {
      sessionId: parsed.sessionId,
      roomId: parsed.sessionId,
      mobileSessionJwt: signMobileToken(parsed.sessionId)
    };
  },

  async saveAnswer(input: SaveAnswerInput) {
    const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
    if (!session || session.candidateId !== input.candidateId) {
      throw new Error("Session not found");
    }

    if (session.status !== SessionStatus.STARTED) {
      throw new Error("Session is not accepting answers");
    }

    const saved = await prisma.answer.upsert({
      where: {
        sessionId_questionId: {
          sessionId: input.sessionId,
          questionId: input.questionId
        }
      },
      create: {
        sessionId: input.sessionId,
        questionId: input.questionId,
        answerType: input.answerType,
        responseJson: input.responseJson as object,
        latencyMs: input.latencyMs
      },
      update: {
        responseJson: input.responseJson as object,
        latencyMs: input.latencyMs
      }
    });

    return {
      saved: true,
      answerId: saved.id,
      serverTimestamp: new Date().toISOString()
    };
  },

  async submit(sessionId: string, candidateId: string, reason: "USER_SUBMIT" | "AUTO_SUBMIT") {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        exam: {
          include: {
            questions: true
          }
        },
        answers: true
      }
    });

    if (!session || session.candidateId !== candidateId) {
      throw new Error("Session not found");
    }

    if (session.status !== SessionStatus.STARTED) {
      return {
        sessionId: session.id,
        submittedAt: session.submittedAt,
        autoScore: session.autoScore,
        status: session.reviewDecision
      };
    }

    let objectivePoints = 0;
    let objectiveMax = 0;

    for (const question of session.exam.questions) {
      if (question.type !== QuestionType.MCQ) {
        continue;
      }

      objectiveMax += question.points;

      const answer = session.answers.find((item) => item.questionId === question.id);
      if (!answer || !question.answerKeyJson) {
        continue;
      }

      const key = question.answerKeyJson as { correctOptionId?: string };
      const resp = answer.responseJson as { mcqOptionId?: string };
      if (key.correctOptionId && key.correctOptionId === resp.mcqOptionId) {
        objectivePoints += question.points;
      }
    }

    const autoScore = objectiveMax > 0 ? (objectivePoints / objectiveMax) * 100 : 0;

    const submitted = await prisma.session.update({
      where: { id: session.id },
      data: {
        status: reason === "AUTO_SUBMIT" ? SessionStatus.AUTO_SUBMITTED : SessionStatus.SUBMITTED,
        submittedAt: new Date(),
        autoScore,
        reviewDecision: "PENDING"
      }
    });

    await prisma.score.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        objectiveScore: autoScore,
        finalScore: autoScore
      },
      update: {
        objectiveScore: autoScore,
        finalScore: autoScore
      }
    });

    return {
      sessionId: submitted.id,
      submittedAt: submitted.submittedAt,
      autoScore,
      status: submitted.reviewDecision
    };
  },

  async addViolationScore(sessionId: string, severity: number) {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        violationScore: {
          increment: severity
        }
      }
    });

    return session.violationScore;
  },

  async autoSubmitIfNeeded(sessionId: string) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== SessionStatus.STARTED) {
      return null;
    }

    if (session.violationScore < env.violationAutoSubmitThreshold) {
      return null;
    }

    return this.submit(sessionId, session.candidateId, "AUTO_SUBMIT");
  },

  async attachSocket(sessionId: string, role: "candidate" | "mobile", socketId: string) {
    if (role === "candidate") {
      await prisma.session.update({
        where: { id: sessionId },
        data: { candidateSocketId: socketId }
      });
      return;
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        mobileSocketId: socketId,
        mobilePairedAt: new Date()
      }
    });
  },

  async heartbeat(sessionId: string, role: "candidate" | "mobile") {
    await redis.set(`heartbeat:${sessionId}:${role}`, Date.now().toString(), "EX", env.sessionHeartbeatTimeoutSeconds);
  }
};
