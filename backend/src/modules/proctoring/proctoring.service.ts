import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { ProctoringEventModel } from "./proctoring.model";
import { sessionsService } from "../sessions/sessions.service";

type ProctoringEventInput = {
  sessionId: string;
  source: "LAPTOP" | "MOBILE" | "SYSTEM";
  eventType: string;
  severity: number;
  timestamp: string;
  meta?: Record<string, unknown>;
};

type AIFrameFinding = {
  eventType: string;
  severity: number;
  confidence: number;
  meta?: Record<string, unknown>;
};

const clampSeverity = (severity: number): number => {
  if (severity < 1) return 1;
  if (severity > 10) return 10;
  return Math.round(severity);
};

const callAIForFrame = async (
  sessionId: string,
  source: "LAPTOP" | "MOBILE" | "SYSTEM",
  frameBase64: string
): Promise<AIFrameFinding[]> => {
  try {
    const response = await fetch(`${env.aiEngineUrl}/analyze/frame`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        source,
        frameBase64
      })
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as { findings?: AIFrameFinding[] };
    return json.findings ?? [];
  } catch {
    return [];
  }
};

const callAIForAudio = async (
  sessionId: string,
  source: "LAPTOP" | "MOBILE" | "SYSTEM",
  audioLevel: number,
  voiceCount?: number,
  mobileSoundDetected?: boolean
): Promise<AIFrameFinding[]> => {
  try {
    const response = await fetch(`${env.aiEngineUrl}/analyze/audio`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId,
        source,
        audioLevel,
        voiceCount,
        mobileSoundDetected
      })
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as { findings?: AIFrameFinding[] };
    return json.findings ?? [];
  } catch {
    return [];
  }
};

export const proctoringService = {
  async ingestEvent(input: ProctoringEventInput) {
    const session = await prisma.session.findUnique({ where: { id: input.sessionId } });
    if (!session) {
      throw new Error("Session not found");
    }

    const normalizedSeverity = clampSeverity(input.severity);

    const created = await ProctoringEventModel.create({
      sessionId: input.sessionId,
      examId: session.examId,
      candidateId: session.candidateId,
      source: input.source,
      eventType: input.eventType,
      severity: normalizedSeverity,
      timestamp: new Date(input.timestamp),
      meta: input.meta ?? {}
    });

    const frameBase64 = input.meta?.frameBase64;
    if (typeof frameBase64 === "string" && frameBase64.length > 0) {
      const aiFindings = await callAIForFrame(input.sessionId, input.source, frameBase64);

      if (aiFindings.length > 0) {
        await ProctoringEventModel.insertMany(
          aiFindings.map((finding) => ({
            sessionId: input.sessionId,
            examId: session.examId,
            candidateId: session.candidateId,
            source: input.source,
            eventType: finding.eventType,
            severity: clampSeverity(finding.severity),
            timestamp: new Date(),
            meta: {
              confidence: finding.confidence,
              ...(finding.meta ?? {})
            }
          }))
        );
      }
    }

    const audioLevelRaw = input.meta?.audioLevel;
    if (typeof audioLevelRaw === "number") {
      const voiceCount = typeof input.meta?.voiceCount === "number" ? input.meta.voiceCount : undefined;
      const mobileSoundDetected =
        typeof input.meta?.mobileSoundDetected === "boolean" ? input.meta.mobileSoundDetected : undefined;

      const audioFindings = await callAIForAudio(
        input.sessionId,
        input.source,
        audioLevelRaw,
        voiceCount,
        mobileSoundDetected
      );

      if (audioFindings.length > 0) {
        await ProctoringEventModel.insertMany(
          audioFindings.map((finding) => ({
            sessionId: input.sessionId,
            examId: session.examId,
            candidateId: session.candidateId,
            source: input.source,
            eventType: finding.eventType,
            severity: clampSeverity(finding.severity),
            timestamp: new Date(),
            meta: {
              confidence: finding.confidence,
              ...(finding.meta ?? {})
            }
          }))
        );
      }
    }

    const riskScore = await sessionsService.addViolationScore(input.sessionId, normalizedSeverity);
    const autoSubmit = await sessionsService.autoSubmitIfNeeded(input.sessionId);

    return {
      eventId: created.id,
      sessionRiskScore: riskScore,
      action: autoSubmit ? "AUTO_SUBMIT" : riskScore >= 70 ? "FLAG" : "WARN"
    };
  },

  async listBySession(sessionId: string) {
    return ProctoringEventModel.find({ sessionId }).sort({ timestamp: 1 }).limit(1000).lean();
  }
};
