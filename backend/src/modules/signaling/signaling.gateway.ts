import { Server, Socket } from "socket.io";
import { Role } from "@prisma/client";
import { verifyAccessToken, verifyMobileToken } from "../../utils/jwt";
import { sessionsService } from "../sessions/sessions.service";

type SocketContext = {
  actorType: "user" | "mobile";
  userId?: string;
  role?: Role;
  mobileSessionId?: string;
};

const roomForSession = (sessionId: string): string => `session:${sessionId}`;

const contexts = new Map<string, SocketContext>();

const authenticateSocket = (socket: Socket): SocketContext | null => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return null;
  }

  try {
    const access = verifyAccessToken(token);
    return {
      actorType: "user",
      userId: access.sub,
      role: access.role
    };
  } catch {
    // Try mobile token next.
  }

  try {
    const mobile = verifyMobileToken(token);
    return {
      actorType: "mobile",
      mobileSessionId: mobile.sessionId
    };
  } catch {
    return null;
  }
};

export const registerSignalingGateway = (io: Server): void => {
  io.on("connection", (socket) => {
    const context = authenticateSocket(socket);
    if (!context) {
      socket.disconnect(true);
      return;
    }

    contexts.set(socket.id, context);

    socket.on("join-room", async (payload: { sessionId: string; role: "candidate" | "mobile" | "admin" }) => {
      try {
        const room = roomForSession(payload.sessionId);

        if (payload.role === "mobile") {
          if (context.actorType !== "mobile" || context.mobileSessionId !== payload.sessionId) {
            socket.emit("error-event", { message: "Mobile token does not match session" });
            return;
          }

          await sessionsService.attachSocket(payload.sessionId, "mobile", socket.id);
          await sessionsService.heartbeat(payload.sessionId, "mobile");
          socket.join(room);
          io.to(room).emit("mobile-paired", { sessionId: payload.sessionId });
          return;
        }

        if (context.actorType !== "user") {
          socket.emit("error-event", { message: "Invalid actor type" });
          return;
        }

        socket.join(room);

        if (payload.role === "candidate") {
          await sessionsService.attachSocket(payload.sessionId, "candidate", socket.id);
          await sessionsService.heartbeat(payload.sessionId, "candidate");
        }

        socket.emit("joined-room", {
          sessionId: payload.sessionId,
          role: payload.role
        });
      } catch (err) {
        socket.emit("error-event", {
          message: err instanceof Error ? err.message : "Failed to join room"
        });
      }
    });

    socket.on("webrtc-offer", (payload: { sessionId: string; source: "laptop" | "mobile" | "screen"; sdp: string }) => {
      socket.to(roomForSession(payload.sessionId)).emit("webrtc-offer", {
        sessionId: payload.sessionId,
        fromSocketId: socket.id,
        source: payload.source,
        sdp: payload.sdp
      });
    });

    socket.on("webrtc-answer", (payload: { sessionId: string; source: "laptop" | "mobile" | "screen"; sdp: string }) => {
      socket.to(roomForSession(payload.sessionId)).emit("webrtc-answer", {
        sessionId: payload.sessionId,
        fromSocketId: socket.id,
        source: payload.source,
        sdp: payload.sdp
      });
    });

    socket.on("webrtc-ice", (payload: { sessionId: string; source: "laptop" | "mobile" | "screen"; candidate: Record<string, unknown> }) => {
      socket.to(roomForSession(payload.sessionId)).emit("webrtc-ice", {
        sessionId: payload.sessionId,
        fromSocketId: socket.id,
        source: payload.source,
        candidate: payload.candidate
      });
    });

    socket.on("request-republish", (payload: { sessionId: string }) => {
      socket.to(roomForSession(payload.sessionId)).emit("republish-request", {
        sessionId: payload.sessionId,
        requestedBy: socket.id
      });
    });

    socket.on("heartbeat", async (payload: { sessionId: string; role: "candidate" | "mobile" }) => {
      await sessionsService.heartbeat(payload.sessionId, payload.role);
      socket.emit("heartbeat-ack", { at: new Date().toISOString() });
    });

    socket.on("violation-alert", (payload: { sessionId: string; eventType: string; severity: number }) => {
      socket.to(roomForSession(payload.sessionId)).emit("violation-alert", {
        ...payload,
        at: new Date().toISOString()
      });
    });

    socket.on("disconnect", () => {
      const ctx = contexts.get(socket.id);
      contexts.delete(socket.id);

      if (!ctx) {
        return;
      }

      io.emit("participant-disconnected", {
        socketId: socket.id,
        actorType: ctx.actorType,
        at: new Date().toISOString()
      });
    });
  });
};
