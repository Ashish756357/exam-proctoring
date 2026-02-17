import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { adminApi } from "./api/client";
import { LiveGrid } from "./components/LiveGrid";
import { ViolationTimeline } from "./components/ViolationTimeline";
import "./styles.css";

const defaultWsBase = (): string => {
  const { hostname, port, origin } = window.location;
  if (hostname === "localhost" && ["5173", "5174", "5175"].includes(port)) {
    return "http://localhost:8080";
  }

  return origin;
};

const WS_BASE = import.meta.env.VITE_WS_BASE || defaultWsBase();

const fallbackIceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

const parseIceServers = (): RTCIceServer[] => {
  const raw = import.meta.env.VITE_ICE_SERVERS_JSON;
  if (!raw) {
    return fallbackIceServers;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return fallbackIceServers;
    }

    return parsed as RTCIceServer[];
  } catch {
    return fallbackIceServers;
  }
};

const ICE_SERVERS = parseIceServers();

type Alert = {
  sessionId: string;
  eventType: string;
  severity: number;
  at: string;
};

type SessionItem = {
  id: string;
  exam: { id: string; title: string };
  candidate: { id: string; name: string; email: string };
  violationScore: number;
  startedAt: string;
  mobilePairedAt?: string;
};

type Source = "laptop" | "mobile" | "screen";

type OfferPayload = {
  sessionId: string;
  source: Source;
  sdp: string;
};

type IcePayload = {
  sessionId: string;
  source: Source;
  candidate: RTCIceCandidateInit;
};

const tokenStorageKey = "admin_token";

function App() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("AdminPass!123");
  const [token, setToken] = useState<string>(() => localStorage.getItem(tokenStorageKey) ?? "");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const selectedSessionRef = useRef<string | null>(null);
  const laptopVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<{ laptop: RTCPeerConnection | null; mobile: RTCPeerConnection | null }>({
    laptop: null,
    mobile: null
  });

  const closePeers = () => {
    peersRef.current.laptop?.close();
    peersRef.current.mobile?.close();
    peersRef.current = { laptop: null, mobile: null };

    if (laptopVideoRef.current) {
      laptopVideoRef.current.srcObject = null;
    }

    if (mobileVideoRef.current) {
      mobileVideoRef.current.srcObject = null;
    }
  };

  const peerKeyForSource = (source: Source): "laptop" | "mobile" => {
    return source === "mobile" ? "mobile" : "laptop";
  };

  const getOrCreatePeer = (source: Source): RTCPeerConnection | null => {
    if (!socketRef.current || !selectedSessionRef.current) {
      return null;
    }

    const key = peerKeyForSource(source);
    const existing = peersRef.current[key];
    if (existing) {
      return existing;
    }

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) {
        return;
      }

      if (key === "mobile") {
        if (mobileVideoRef.current) {
          mobileVideoRef.current.srcObject = stream;
        }
        return;
      }

      if (laptopVideoRef.current) {
        laptopVideoRef.current.srcObject = stream;
      }
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current || !selectedSessionRef.current) {
        return;
      }

      socketRef.current.emit("webrtc-ice", {
        sessionId: selectedSessionRef.current,
        source: key,
        candidate: event.candidate.toJSON()
      });
    };

    peersRef.current[key] = peer;
    return peer;
  };

  useEffect(() => {
    selectedSessionRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = io(WS_BASE, {
      path: "/ws",
      transports: ["websocket"],
      auth: { token }
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (selectedSessionRef.current) {
        socket.emit("join-room", { sessionId: selectedSessionRef.current, role: "admin" });
      }
    });

    socket.on("violation-alert", (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 30));
    });

    socket.on("webrtc-offer", async (payload: OfferPayload) => {
      if (!selectedSessionRef.current || payload.sessionId !== selectedSessionRef.current) {
        return;
      }

      const peer = getOrCreatePeer(payload.source);
      if (!peer || peer.signalingState === "closed") {
        return;
      }

      await peer.setRemoteDescription({ type: "offer", sdp: payload.sdp });
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("webrtc-answer", {
        sessionId: payload.sessionId,
        source: payload.source,
        sdp: answer.sdp
      });
    });

    socket.on("webrtc-ice", async (payload: IcePayload) => {
      if (!selectedSessionRef.current || payload.sessionId !== selectedSessionRef.current) {
        return;
      }

      const peer = getOrCreatePeer(payload.source);
      if (!peer || peer.signalingState === "closed") {
        return;
      }

      await peer.addIceCandidate(payload.candidate);
    });

    return () => {
      closePeers();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = () => {
      adminApi
        .listLiveSessions(token)
        .then((res) => setSessions(res.items))
        .catch((err) => setNotice(err instanceof Error ? err.message : "Failed to load sessions"));
    };

    load();
    const interval = window.setInterval(load, 8000);

    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedSessionId) {
      return;
    }

    adminApi
      .sessionEvents(token, selectedSessionId)
      .then((res) => setEvents(res.items))
      .catch((err) => setNotice(err instanceof Error ? err.message : "Failed to load events"));
  }, [selectedSessionId, token]);

  useEffect(() => {
    if (!socketRef.current || !selectedSessionId) {
      return;
    }

    closePeers();

    socketRef.current.emit("join-room", {
      sessionId: selectedSessionId,
      role: "admin"
    });

    socketRef.current.emit("request-republish", {
      sessionId: selectedSessionId
    });
  }, [selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    try {
      const auth = await adminApi.login(email, password);
      setToken(auth.accessToken);
      localStorage.setItem(tokenStorageKey, auth.accessToken);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Login failed");
    }
  };

  if (!token) {
    return (
      <main className="admin-shell centered">
        <section className="panel login-panel">
          <h1>Admin Proctor Dashboard</h1>
          <form onSubmit={login} className="form-grid">
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <button type="submit">Sign in</button>
          </form>
          {notice ? <p className="error">{notice}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="panel topbar">
        <h1>Live Proctoring</h1>
        <button
          onClick={() => {
            localStorage.removeItem(tokenStorageKey);
            setToken("");
            setSessions([]);
            setSelectedSessionId(null);
            closePeers();
          }}
        >
          Logout
        </button>
      </header>

      {alerts.length > 0 ? (
        <section className="panel alerts-panel">
          <h2>Real-time Alerts</h2>
          <div className="alerts-list">
            {alerts.map((alert, idx) => (
              <div key={`${alert.sessionId}-${alert.at}-${idx}`} className="alert-item">
                <strong>{alert.eventType}</strong>
                <span>Session: {alert.sessionId.slice(0, 8)}</span>
                <span>Severity: {alert.severity}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <LiveGrid
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelect={(sessionId) => setSelectedSessionId(sessionId)}
      />

      <section className="panel review-panel">
        <h2>Review Actions</h2>
        {selectedSession ? (
          <>
            <p>
              {selectedSession.candidate.name} - {selectedSession.exam.title}
            </p>

            <div className="live-feed-row">
              <div className="live-feed-block">
                <h3>Laptop Feed</h3>
                <video ref={laptopVideoRef} autoPlay playsInline muted />
              </div>
              <div className="live-feed-block">
                <h3>Mobile Feed</h3>
                <video ref={mobileVideoRef} autoPlay playsInline muted />
              </div>
            </div>

            <div className="button-row">
              <button
                onClick={() =>
                  adminApi
                    .decide(token, selectedSession.id, "APPROVED", "Session reviewed and approved")
                    .then(() => setNotice("Decision saved: APPROVED"))
                    .catch((err) => setNotice(err instanceof Error ? err.message : "Decision failed"))
                }
              >
                Approve
              </button>
              <button
                className="danger"
                onClick={() =>
                  adminApi
                    .decide(token, selectedSession.id, "REJECTED", "Violation threshold exceeded")
                    .then(() => setNotice("Decision saved: REJECTED"))
                    .catch((err) => setNotice(err instanceof Error ? err.message : "Decision failed"))
                }
              >
                Reject
              </button>
            </div>
          </>
        ) : (
          <p>Select a session from live grid.</p>
        )}
      </section>

      <ViolationTimeline events={events} />

      {notice ? <p className="error floating-error">{notice}</p> : null}
    </main>
  );
}

export default App;
