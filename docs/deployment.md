# Deployment Guide

## 1. Deployment Target (Global)

Use one public domain with HTTPS, for example `https://exam.example.com`, and route:

- Candidate app: `https://exam.example.com/candidate/`
- Mobile app: `https://exam.example.com/mobile/`
- Admin app: `https://exam.example.com/admin/`
- API: `https://exam.example.com/api/v1`
- WebSocket signaling: `wss://exam.example.com/ws`

Minimum production components:

- 1 reverse proxy / load balancer (TLS termination)
- 1 backend API + signaling service
- 1 AI engine service
- PostgreSQL, MongoDB, Redis (managed services recommended)
- TURN server (required for reliable WebRTC across NAT/firewall)

## 2. Required Environment Configuration

Backend (`backend/.env`):

```env
NODE_ENV=production
PORT=8080
CORS_ORIGIN=https://exam.example.com
MOBILE_APP_BASE_URL=https://exam.example.com/mobile
JWT_ACCESS_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<strong-secret>
JWT_MOBILE_SECRET=<strong-secret>
ENCRYPTION_KEY_HEX=<64-byte-hex>
```

Frontend apps (candidate/mobile/admin) optional overrides:

```env
VITE_API_BASE=https://exam.example.com/api/v1
VITE_WS_BASE=https://exam.example.com
```

If these are not set, apps default to:

- `http://localhost:8080` for local dev ports (`5173/5174/5175`)
- current site origin for deployed/public domains

WebRTC ICE/TURN (set in each frontend app build env):

```env
VITE_ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"exam_turn","credential":"turn_password"}]
```

PowerShell example before `docker compose up --build`:

```powershell
$env:CORS_ORIGIN="https://exam.example.com"
$env:MOBILE_APP_BASE_URL="https://exam.example.com/mobile"
$env:JWT_ACCESS_SECRET="<strong-secret>"
$env:JWT_REFRESH_SECRET="<strong-secret>"
$env:JWT_MOBILE_SECRET="<strong-secret>"
$env:VITE_ICE_SERVERS_JSON='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"exam_turn","credential":"turn_password"}]'
```

## 3. Build and Run (Docker Compose)

```bash
cd infra
docker compose up --build -d
```

`VITE_API_BASE`, `VITE_WS_BASE`, and `VITE_ICE_SERVERS_JSON` are passed as Docker build args from shell environment variables when present.

Initialize data:

```bash
docker compose exec backend npx prisma db push
docker compose exec backend node prisma/seed.js
```

## 4. Reverse Proxy and TLS

- Terminate TLS at reverse proxy (`443`).
- Proxy `/api` and `/ws` to backend.
- Proxy `/candidate`, `/mobile`, `/admin` to frontend services.
- Forward `Upgrade` and `Connection` headers for `/ws`.

Use a real certificate (LetsEncrypt or managed cert service). Browsers can block camera/mic on insecure origins.

## 5. Global Mobile Pairing Behavior

`MOBILE_APP_BASE_URL` controls the QR/pairing URL returned by backend.

- Local testing can use `http://localhost:5174`.
- Public deployment must use your public HTTPS mobile URL (for example `https://exam.example.com/mobile`).
- Do not keep `localhost` in production pairing URLs, or phones will fail to open the app.

## 6. Validation Checklist

- Candidate can login and start exam from an external network.
- QR code opens mobile app on phone and pairing succeeds.
- Phone shows live local preview of what is being captured.
- Admin receives both laptop and mobile feeds.
- WebSocket stays connected for at least 15 minutes under real network conditions.

## 7. Production Hardening

- Replace demo credentials and all defaults.
- Rotate JWT secrets and TURN credentials regularly.
- Enable backups + retention for PostgreSQL/MongoDB.
- Add monitoring (CPU, RAM, DB, Redis, socket disconnect rate).
- Add alerting for heartbeat timeout spikes and WebRTC failure rate.
