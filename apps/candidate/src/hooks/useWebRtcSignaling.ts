import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Source = "laptop";

type UseWebRtcSignalingInput = {
  token: string;
  sessionId: string;
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
};

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

export const useWebRtcSignaling = ({
  token,
  sessionId,
  webcamStream,
  screenStream
}: UseWebRtcSignalingInput): { status: Status; mobilePaired: boolean } => {
  const [status, setStatus] = useState<Status>("idle");
  const [mobilePaired, setMobilePaired] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const publishOfferRef = useRef<(() => Promise<void>) | null>(null);

  const activeStreams = useMemo(() => {
    return webcamStream ? [webcamStream] : [];
  }, [webcamStream]);

  useEffect(() => {
    if (!token || !sessionId) {
      return;
    }

    const socket = io(WS_BASE, {
      path: "/ws",
      transports: ["websocket"],
      auth: {
        token
      }
    });

    socketRef.current = socket;
    setStatus("connecting");

    socket.on("connect", () => {
      socket.emit("join-room", { sessionId, role: "candidate" });
      setStatus("connected");
    });

    socket.on("mobile-paired", () => {
      setMobilePaired(true);
    });

    socket.on("webrtc-answer", async (payload: { source: "laptop" | "mobile" | "screen"; sdp: string }) => {
      if (!peerRef.current) {
        return;
      }
      if (payload.source !== "laptop") {
        return;
      }

      if (!peerRef.current.currentRemoteDescription) {
        await peerRef.current.setRemoteDescription({
          type: "answer",
          sdp: payload.sdp
        });
      }
    });

    socket.on("webrtc-offer", async (payload: { source: "laptop" | "mobile" | "screen"; sdp: string }) => {
      if (!peerRef.current) {
        return;
      }
      if (payload.source !== "laptop") {
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
        source: payload.source,
        sdp: answer.sdp
      });
    });

    socket.on("webrtc-ice", async (payload: { source: "laptop" | "mobile" | "screen"; candidate: RTCIceCandidateInit }) => {
      if (!peerRef.current) {
        return;
      }
      if (payload.source !== "laptop") {
        return;
      }

      await peerRef.current.addIceCandidate(payload.candidate);
    });

    socket.on("republish-request", () => {
      publishOfferRef.current?.().catch(() => {
        setStatus("idle");
      });
    });

    const heartbeatInterval = window.setInterval(() => {
      socket.emit("heartbeat", {
        sessionId,
        role: "candidate"
      });
    }, 5000);

    return () => {
      window.clearInterval(heartbeatInterval);
      socket.disconnect();
      socketRef.current = null;
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      setStatus("idle");
    };
  }, [sessionId, token]);

  useEffect(() => {
    if (!socketRef.current || status !== "connected" || activeStreams.length === 0) {
      return;
    }

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    peerRef.current = peer;

    activeStreams.forEach((stream) => {
      const source: Source = "laptop";
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      peer.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit("webrtc-ice", {
            sessionId,
            candidate: event.candidate.toJSON(),
            source
          });
        }
      };
    });

    const publish = async () => {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socketRef.current?.emit("webrtc-offer", {
        sessionId,
        source: "laptop",
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
  }, [activeStreams, sessionId, status]);

  return { status, mobilePaired };
};
