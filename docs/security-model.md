# Security Model

## Mandatory Controls Implemented

- HTTPS everywhere (TLS termination in reverse proxy).
- JWT access tokens (short TTL) + refresh token rotation (Redis session store).
- Device fingerprint and IP binding checks on login, refresh, and session start.
- One-time, time-bound mobile pairing tokens.
- Server-side exam state machine enforcement.
- Fullscreen/tab-switch violations generated server-side from trusted event ingestion.
- AES-256 helper for sensitive video/screenshot artifact encryption metadata.
- Role-based authorization for candidate/proctor/admin.
- Rate limiting on auth and event ingestion routes.
- Structured audit logging for admin decisions.

## Threat Model Coverage

- Credential replay: mitigated with refresh rotation + jti revocation.
- Session hijacking: fingerprint + IP checks and token expiry.
- Client tampering: no scoring or violation trust on frontend.
- Event forgery: JWT-bound source + schema validation.
- Mobile pairing abuse: single-use pairing token + short TTL + server consume semantics.

## Recommended Production Hardening

- mTLS between backend and AI engine.
- Managed KMS for envelope encryption keys.
- WAF + bot protection in front of reverse proxy.
- Immutable object storage policies for proctoring evidence.
- Optional hardware-backed WebAuthn for admin accounts.
