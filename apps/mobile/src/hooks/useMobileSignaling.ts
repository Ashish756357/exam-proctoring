import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Status = "idle" | "connecting" | "connected";

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

type Input = {
  mobileToken: string;
  sessionId: string;
  stream: MediaStream | null;
};

export const useMobileSignaling = ({ mobileToken, sessionId, stream }: Input): Status => {
  const [status, setStatus] = useState<Status>("idle");
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const publishOfferRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!mobileToken || !sessionId) {
      return;
    }

    const socket = io(WS_BASE, {
      path: "/ws",
      transports: ["websocket"],
      auth: {
        token: mobileToken
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;
    setStatus("connecting");

    socket.on("connect", () => {
      socket.emit("join-room", { sessionId, role: "mobile" });
      setStatus("connected");
    });

    socket.on("disconnect", () => {
      setStatus("connecting");
    });

    socket.on("webrtc-offer", async (payload: { source: "mobile" | "laptop" | "screen"; sdp: string }) => {
      if (!peerRef.current) {
        return;
      }
      if (payload.source !== "mobile") {
        return;
      }

      await peerRef.current.setRemoteDescription({
        type: "offer",
        sdp: payload.sdp
      });
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socket.emit("webrtc-answer", {
        sessionId,
        source: "mobile",
        sdp: answer.sdp
      });
    });

    socket.on("webrtc-answer", async (payload: { source: "mobile" | "laptop" | "screen"; sdp: string }) => {
      if (!peerRef.current || peerRef.current.currentRemoteDescription) {
        return;
      }
      if (payload.source !== "mobile") {
        return;
      }

      await peerRef.current.setRemoteDescription({
        type: "answer",
        sdp: payload.sdp
      });
    });

    socket.on("webrtc-ice", async (payload: { source: "mobile" | "laptop" | "screen"; candidate: RTCIceCandidateInit }) => {
      if (!peerRef.current) {
        return;
      }
      if (payload.source !== "mobile") {
        return;
      }

      await peerRef.current.addIceCandidate(payload.candidate);
    });

    socket.on("republish-request", () => {
      publishOfferRef.current?.().catch(() => {
        setStatus("idle");
      });
    });

    const interval = window.setInterval(() => {
      socket.emit("heartbeat", { sessionId, role: "mobile" });
    }, 5000);

    return () => {
      window.clearInterval(interval);
      socket.disconnect();
      socketRef.current = null;
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      setStatus("idle");
    };
  }, [mobileToken, sessionId]);

  useEffect(() => {
    if (!stream || !socketRef.current || status !== "connected") {
      return;
    }

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    peerRef.current = peer;

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current) {
        return;
      }

      socketRef.current.emit("webrtc-ice", {
        sessionId,
        source: "mobile",
        candidate: event.candidate.toJSON()
      });
    };

    const publish = async () => {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socketRef.current?.emit("webrtc-offer", {
        sessionId,
        source: "mobile",
        sdp: offer.sdp
      });
    };

    publishOfferRef.current = publish;

    publish().catch(() => {
      setStatus("idle");
    });

    return () => {
      publishOfferRef.current = null;
      peer.close();
      if (peerRef.current === peer) {
        peerRef.current = null;
      }
    };
  }, [sessionId, status, stream]);

  return status;
};
