# Backend Authentication Flow

## Token Types

- Access token (JWT): short-lived, used for API and Socket.IO user auth.
- Refresh token (JWT): long-lived, rotated every refresh request.
- Mobile session token (JWT): issued after QR pairing claim, scoped to one session.

## Login

1. Client sends `POST /api/v1/auth/login` with credentials, fingerprint, IP hint.
2. Server validates password hash from PostgreSQL.
3. Server creates refresh session record in PostgreSQL + Redis (`refresh:{jti}`).
4. Server returns access token + refresh token.

## Refresh (Rotation)

1. Client sends `POST /api/v1/auth/refresh` with refresh token + same fingerprint/IP.
2. Server validates JWT signature and checks Redis record (`refresh:{jti}`).
3. Server verifies fingerprint/IP binding.
4. Server revokes old `jti` and issues new access/refresh pair.
5. New refresh session is persisted; old token becomes invalid.

## Logout

1. Client sends `POST /api/v1/auth/logout` with refresh token.
2. Server revokes refresh `jti` in Redis and marks DB row revoked.
3. Logout is idempotent.

## Mobile Pairing Auth

1. Candidate requests one-time pairing token: `POST /api/v1/sessions/{id}/pairing-token`.
2. Server stores one-time key in Redis with short TTL (`pairing:{token}`).
3. Mobile claims token at `POST /api/v1/pairing/claim`.
4. Server consumes pairing token and returns `mobileSessionJwt` bound to session.
5. Mobile uses `mobileSessionJwt` for WebSocket join and proctoring event ingestion.

## Security Checks

- Role-based access control on admin/candidate routes.
- Token source separation (`requireAuth` vs `requireAccessOrMobile`).
- Mobile token constrained to its own `sessionId` and `source=MOBILE` events.
- Rate limiting on auth and event ingestion endpoints.
