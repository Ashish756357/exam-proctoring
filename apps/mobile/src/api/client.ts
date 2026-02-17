const defaultApiBase = (): string => {
  const { hostname, port, origin } = window.location;
  if (hostname === "localhost" && ["5173", "5174", "5175"].includes(port)) {
    return "http://localhost:8080/api/v1";
  }

  return `${origin}/api/v1`;
};

const API_BASE = import.meta.env.VITE_API_BASE || defaultApiBase();

const fingerprint = (): string => {
  const base = `${navigator.userAgent}|${screen.width}x${screen.height}|mobile`;
  return btoa(base).replace(/=/g, "");
};

export const mobileApi = {
  async claimPairing(pairingToken: string) {
    const res = await fetch(`${API_BASE}/pairing/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        pairingToken,
        deviceFingerprint: fingerprint()
      })
    });

    if (!res.ok) {
      throw new Error("Invalid or expired pairing token");
    }

    return res.json() as Promise<{
      mobileSessionJwt: string;
      sessionId: string;
      roomId: string;
    }>;
  },

  async sendViolation(
    token: string,
    payload: {
      sessionId: string;
      eventType: string;
      severity: number;
      meta?: Record<string, unknown>;
    }
  ) {
    const res = await fetch(`${API_BASE}/proctoring/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        sessionId: payload.sessionId,
        source: "MOBILE",
        eventType: payload.eventType,
        severity: payload.severity,
        timestamp: new Date().toISOString(),
        meta: payload.meta ?? {}
      })
    });

    if (!res.ok) {
      throw new Error("Failed to post mobile violation event");
    }

    return res.json();
  }
};
