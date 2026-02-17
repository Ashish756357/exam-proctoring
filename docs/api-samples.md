# API Samples

Base URL: `/api/v1`

## Auth

### POST `/auth/login`

Request:

```json
{
  "email": "candidate@example.com",
  "password": "StrongPassword!123",
  "deviceFingerprint": "3f74014f8f53...",
  "ipAddress": "203.0.113.10"
}
```

Response:

```json
{
  "accessToken": "eyJhbGci...",
  "accessTokenExpiresIn": 900,
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "usr_01",
    "role": "CANDIDATE",
    "name": "Candidate One"
  }
}
```

### POST `/auth/refresh`

Request:

```json
{
  "refreshToken": "eyJhbGci...",
  "deviceFingerprint": "3f74014f8f53...",
  "ipAddress": "203.0.113.10"
}
```

Response:

```json
{
  "accessToken": "eyJhbGci...",
  "accessTokenExpiresIn": 900,
  "refreshToken": "eyJhbGci..."
}
```

## Exams

### GET `/exams/assigned`

Response:

```json
{
  "items": [
    {
      "id": "exam_1001",
      "title": "Data Structures Midterm",
      "startsAt": "2026-03-01T10:00:00Z",
      "endsAt": "2026-03-01T12:00:00Z",
      "durationMinutes": 120,
      "status": "SCHEDULED"
    }
  ]
}
```

### POST `/sessions/start`

Request:

```json
{
  "examId": "exam_1001",
  "deviceFingerprint": "3f74014f8f53...",
  "ipAddress": "203.0.113.10"
}
```

Response:

```json
{
  "sessionId": "sess_91ad",
  "startedAt": "2026-03-01T10:02:18Z",
  "expiresAt": "2026-03-01T12:02:18Z",
  "webrtcRoom": "sess_91ad"
}
```

### POST `/sessions/{sessionId}/pairing-token`

Response:

```json
{
  "pairingToken": "pair_8OaL...",
  "expiresInSeconds": 300,
  "pairingUrl": "https://mobile.exam.local/pair?token=pair_8OaL..."
}
```

### POST `/pairing/claim`

Request:

```json
{
  "pairingToken": "pair_8OaL...",
  "deviceFingerprint": "a76d9f22..."
}
```

Response:

```json
{
  "mobileSessionJwt": "eyJhbGci...",
  "sessionId": "sess_91ad",
  "roomId": "sess_91ad"
}
```

## Answers + Submission

### POST `/sessions/{sessionId}/answers`

Request:

```json
{
  "questionId": "q_11",
  "answerType": "MCQ",
  "mcqOptionId": "opt_B",
  "latencyMs": 2230
}
```

Response:

```json
{
  "saved": true,
  "answerId": "ans_2831",
  "serverTimestamp": "2026-03-01T10:31:21Z"
}
```

### POST `/sessions/{sessionId}/submit`

Request:

```json
{
  "reason": "USER_SUBMIT"
}
```

Response:

```json
{
  "sessionId": "sess_91ad",
  "submittedAt": "2026-03-01T11:45:02Z",
  "autoScore": 74,
  "status": "PENDING_ADMIN_REVIEW"
}
```

## Proctoring Events

### POST `/proctoring/events`

Request:

```json
{
  "sessionId": "sess_91ad",
  "source": "LAPTOP",
  "eventType": "NO_FACE",
  "severity": 5,
  "timestamp": "2026-03-01T10:15:45Z",
  "meta": {
    "durationSeconds": 8,
    "confidence": 0.91,
    "frameRef": "enc://events/sess_91ad/evt_301.jpg"
  }
}
```

Response:

```json
{
  "eventId": "evt_301",
  "sessionRiskScore": 24,
  "action": "WARN"
}
```

## Admin Actions

### POST `/admin/sessions/{sessionId}/decision`

Request:

```json
{
  "decision": "REJECTED",
  "reason": "Multiple faces + repeated tab switching"
}
```

Response:

```json
{
  "sessionId": "sess_91ad",
  "decision": "REJECTED",
  "decidedBy": "admin_02",
  "decidedAt": "2026-03-01T14:01:09Z"
}
```
