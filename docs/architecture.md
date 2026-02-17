# System Architecture

## 1. High-Level Diagram

```mermaid
flowchart LR
  subgraph CandidateLaptop[Candidate Laptop App (React)]
    CUI[Exam UI + Anti-Cheat Hooks]
    CRTC[WebRTC: Webcam + Mic + Screen]
    CSIG[Socket.IO Signaling]
  end

  subgraph MobileCam[Mobile Proctor App (React/PWA)]
    MPAIR[QR Pairing]
    MRTC[WebRTC Rear Camera]
    MSIG[Socket.IO Signaling]
  end

  subgraph Backend[Backend (Node.js + Express)]
    API[REST API]
    WS[Socket.IO Gateway]
    RULES[Proctoring Rules Engine]
    SCORE[Auto Scoring + Overrides]
  end

  subgraph AI[AI Proctoring Engine (FastAPI + OpenCV/MediaPipe)]
    FACE[Face + Multi-face Detection]
    GAZE[Eye Gaze + Head Pose]
    AUDIO[Audio Violation Detection]
  end

  subgraph Data[Data Layer]
    PG[(PostgreSQL)]
    MONGO[(MongoDB)]
    REDIS[(Redis)]
    OBJ[(Encrypted Object Storage)]
  end

  subgraph Admin[Admin Dashboard (React)]
    GRID[Live Candidate Grid]
    ALERTS[Real-time Alerts]
    REVIEW[Timeline + Replay + Decision]
  end

  CUI --> API
  CSIG --> WS
  CRTC --> WS

  MPAIR --> API
  MSIG --> WS
  MRTC --> WS

  API --> PG
  API --> REDIS
  RULES --> MONGO
  WS --> MONGO

  RULES --> AI
  AI --> RULES
  RULES --> SCORE

  GRID --> WS
  ALERTS --> WS
  REVIEW --> API

  RULES --> OBJ
```

## 2. Data Responsibilities

- PostgreSQL stores transactional entities: users, exams, questions, sessions, answers, scores, admin actions.
- MongoDB stores high-volume proctoring events and stream metadata.
- Redis stores short-lived state: refresh-token sessions, WebRTC pairing tokens, anti-replay nonce data.
- Encrypted object storage holds screen/video artifacts referenced by event metadata.

## 3. Authentication Flow (JWT + Refresh Rotation)

```mermaid
sequenceDiagram
  participant U as Candidate
  participant FE as Candidate App
  participant API as Backend API
  participant R as Redis
  participant PG as PostgreSQL

  U->>FE: login(email, password, fingerprint)
  FE->>API: POST /auth/login
  API->>PG: validate user + role + status
  API->>R: store refresh session (jti, ip, fingerprint, exp)
  API-->>FE: accessToken (short TTL) + refreshToken (httpOnly)

  FE->>API: protected request (Bearer accessToken)
  API-->>FE: data

  FE->>API: POST /auth/refresh (refresh token)
  API->>R: verify old jti + bind ip/fingerprint
  API->>R: rotate jti (invalidate old)
  API-->>FE: new access + refresh

  FE->>API: POST /auth/logout
  API->>R: revoke refresh jti
  API-->>FE: logged out
```

## 4. Dual-Camera Pairing + Signaling Flow

```mermaid
sequenceDiagram
  participant C as Candidate App (Laptop)
  participant API as Backend API
  participant R as Redis
  participant M as Mobile App
  participant WS as Socket Gateway
  participant A as Admin Dashboard

  C->>API: POST /sessions/{id}/pairing-token
  API->>R: save one-time token (ttl=5 min, sessionId)
  API-->>C: pairingUrl + qrPayload

  M->>API: POST /pairing/claim {token, fingerprint}
  API->>R: validate + consume token
  API-->>M: mobileSessionJwt

  C->>WS: join-room(sessionId, role=candidate)
  M->>WS: join-room(sessionId, role=mobile, mobileSessionJwt)
  WS-->>C: mobile-paired

  C->>WS: webrtc-offer(laptop-cam/screen)
  M->>WS: webrtc-offer(mobile-cam)
  WS-->>A: track-published(sessionId, source)
  A->>WS: subscribe(sessionId)

  WS->>A: candidate-stream + mobile-stream + events
```

## 5. Violation Pipeline

1. Client and signaling events produce raw monitoring signals.
2. Backend normalizes signals and forwards frames/audio snippets to AI engine.
3. AI engine returns detections with confidence and severity hints.
4. Rules engine applies thresholds/time windows to produce canonical violations.
5. Violations are saved in MongoDB and streamed to admins in real time.
6. Cumulative score can auto-submit or auto-flag a session.

## 6. Failure Handling

- Mobile network drop triggers reconnect loop with session resume token.
- Session heartbeat timeout marks stream as interrupted and raises a violation.
- If candidate leaves fullscreen/tab switches repeatedly, violation score increases.
- Submission endpoint is idempotent and server-timestamped.
