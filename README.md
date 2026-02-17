# Protected Exam Portal

Production-grade online examination platform with AI-based proctoring, dual-camera monitoring (laptop + mobile), and admin review workflows.

## Monorepo Structure

- `backend/`: Node.js + Express + Socket.IO API/signaling server
- `ai-engine/`: FastAPI service for face/gaze/audio analysis
- `apps/candidate/`: React candidate exam app (laptop)
- `apps/mobile/`: React mobile proctor camera app (third-person)
- `apps/admin/`: React admin/proctor dashboard
- `infra/`: Docker Compose and reverse proxy
- `docs/`: Architecture, schema, API samples, deployment, security model

## Core Capabilities

- JWT auth with refresh token rotation
- Exam scheduling, randomization, timed sessions, secure submission
- WebRTC signaling for dual-camera pairing and live streams
- AI proctoring event pipeline with severity scoring
- Real-time violation alerts to admin dashboard
- Violation timeline and manual result approval/rejection

## Quick Start (Docker)

```bash
cd infra
docker compose up --build
```

Then initialize data:

```bash
docker compose exec backend npx prisma db push
docker compose exec backend node prisma/seed.js
```

Services:

- API + signaling: `http://localhost:8080/api/v1`
- Candidate app: `http://localhost:5173`
- Mobile app: `http://localhost:5174`
- Admin app: `http://localhost:5175`
- AI service: `http://localhost:8090`

If you pair from a real phone on the same LAN, set backend `MOBILE_APP_BASE_URL` to
`http://<your-computer-ip>:5174` so QR links open correctly on the phone.

## Quick Start (Local Windows, No Docker)

Use the provided orchestration scripts:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
```

Health check:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\health-check.ps1
```

Stop everything:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-all.ps1
```

Default demo credentials:

- Candidate: `candidate@example.com` / `CandidatePass!123`
- Admin: `admin@example.com` / `AdminPass!123`

## Environment

Copy templates and fill secrets:

- `backend/.env.example -> backend/.env`
- `ai-engine/.env.example -> ai-engine/.env`
- Set `MOBILE_APP_BASE_URL` in backend env for pairing QR links (use your public mobile URL in production).
- For global WebRTC reliability, set `VITE_ICE_SERVERS_JSON` in frontend builds with your TURN server.
- In Docker Compose, frontend `VITE_*` values are consumed as build args (set them in shell before `docker compose up --build`).

## Security Highlights

- HTTPS termination at reverse proxy
- JWT access + refresh tokens, Redis-backed refresh rotation
- Time-bound session and mobile pairing tokens
- Device fingerprint and IP binding checks
- Server-side anti-cheat enforcement (no client trust)
- AES-256 encryption helper for sensitive artifacts

## Docs

- `docs/architecture.md`
- `docs/folder-structure.md`
- `docs/database-schema.md`
- `docs/api-samples.md`
- `docs/auth-flow.md`
- `docs/webrtc-signaling.md`
- `docs/deployment.md`
- `docs/security-model.md`
# exam-proctoring
