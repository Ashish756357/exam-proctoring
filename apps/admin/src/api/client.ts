const defaultApiBase = (): string => {
  const { hostname, port, origin } = window.location;
  if (hostname === "localhost" && ["5173", "5174", "5175"].includes(port)) {
    return "http://localhost:8080/api/v1";
  }

  return `${origin}/api/v1`;
};

const API_BASE = import.meta.env.VITE_API_BASE || defaultApiBase();

const jsonHeaders = {
  "content-type": "application/json"
};

const fingerprint = (): string => {
  const base = `${navigator.userAgent}|admin`;
  return btoa(base).replace(/=/g, "");
};

export const adminApi = {
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        email,
        password,
        deviceFingerprint: fingerprint(),
        ipAddress: "0.0.0.0"
      })
    });

    if (!res.ok) {
      throw new Error("Login failed");
    }

    return res.json() as Promise<{ accessToken: string; user: { id: string; role: string; name: string } }>;
  },

  async listLiveSessions(token: string) {
    const res = await fetch(`${API_BASE}/admin/sessions/live`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error("Failed to load live sessions");
    }

    return res.json() as Promise<{
      items: Array<{
        id: string;
        exam: { id: string; title: string };
        candidate: { id: string; name: string; email: string };
        violationScore: number;
        startedAt: string;
        mobilePairedAt?: string;
      }>;
    }>;
  },

  async sessionEvents(token: string, sessionId: string) {
    const res = await fetch(`${API_BASE}/proctoring/sessions/${sessionId}/events`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error("Failed to load session events");
    }

    return res.json() as Promise<{
      items: Array<{
        _id: string;
        eventType: string;
        severity: number;
        source: string;
        timestamp: string;
      }>;
    }>;
  },

  async decide(token: string, sessionId: string, decision: "APPROVED" | "REJECTED", reason: string) {
    const res = await fetch(`${API_BASE}/admin/sessions/${sessionId}/decision`, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        decision,
        reason
      })
    });

    if (!res.ok) {
      throw new Error("Decision update failed");
    }

    return res.json();
  }
};
