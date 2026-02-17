const defaultApiBase = (): string => {
  const { hostname, port, origin } = window.location;
  if (hostname === "localhost" && ["5173", "5174", "5175"].includes(port)) {
    return "http://localhost:8080/api/v1";
  }

  return `${origin}/api/v1`;
};

const API_BASE = import.meta.env.VITE_API_BASE || defaultApiBase();

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  user: {
    id: string;
    role: "CANDIDATE" | "ADMIN" | "PROCTOR";
    name: string;
  };
};

export type ExamQuestion = {
  id: string;
  type: "MCQ" | "CODING" | "SUBJECTIVE";
  prompt: string;
  optionsJson?: {
    choices?: Array<{ id: string; text: string }>;
  };
  points: number;
};

export type CandidateExam = {
  id: string;
  title: string;
  instructions: string;
  durationMinutes: number;
  startsAt: string;
  endsAt: string;
  questions: ExamQuestion[];
};

const jsonHeaders = {
  "content-type": "application/json"
};

const fingerprint = (): string => {
  const base = `${navigator.userAgent}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  return btoa(base).replace(/=/g, "");
};

const ipHint = (): string => "0.0.0.0";

export const api = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email,
        password,
        deviceFingerprint: fingerprint(),
        ipAddress: ipHint()
      })
    });

    if (!res.ok) {
      throw new Error("Login failed");
    }

    return res.json();
  },

  async getAssigned(token: string) {
    const res = await fetch(`${API_BASE}/exams/assigned`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error("Failed to load assigned exams");
    }

    return res.json() as Promise<{ items: Array<{ id: string; title: string; durationMinutes: number }> }>;
  },

  async getExam(token: string, examId: string): Promise<CandidateExam> {
    const res = await fetch(`${API_BASE}/exams/${examId}`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error("Failed to load exam");
    }

    return res.json();
  },

  async startSession(token: string, examId: string) {
    const res = await fetch(`${API_BASE}/sessions/start`, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        examId,
        deviceFingerprint: fingerprint(),
        ipAddress: ipHint()
      })
    });

    if (!res.ok) {
      throw new Error("Failed to start session");
    }

    return res.json() as Promise<{
      sessionId: string;
      startedAt: string;
      expiresAt: string;
      webrtcRoom: string;
    }>;
  },

  async createPairingToken(token: string, sessionId: string) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/pairing-token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error("Failed to create pairing token");
    }

    return res.json() as Promise<{
      pairingToken: string;
      expiresInSeconds: number;
      pairingUrl: string;
    }>;
  },

  async saveAnswer(
    token: string,
    sessionId: string,
    payload: {
      questionId: string;
      answerType: "MCQ" | "CODING" | "SUBJECTIVE";
      responseJson: unknown;
      latencyMs?: number;
    }
  ) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/answers`, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error("Failed to save answer");
    }

    return res.json();
  },

  async submitSession(token: string, sessionId: string) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/submit`, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ reason: "USER_SUBMIT" })
    });

    if (!res.ok) {
      throw new Error("Failed to submit session");
    }

    return res.json();
  },

  async sendViolation(
    token: string,
    payload: {
      sessionId: string;
      source: "LAPTOP" | "MOBILE" | "SYSTEM";
      eventType: string;
      severity: number;
      meta?: Record<string, unknown>;
    }
  ) {
    const res = await fetch(`${API_BASE}/proctoring/events`, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString()
      })
    });

    if (!res.ok) {
      throw new Error("Failed to send violation event");
    }

    return res.json();
  }
};
