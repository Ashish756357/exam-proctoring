# Database Schema

## Relational (PostgreSQL)

Managed via Prisma: `backend/prisma/schema.prisma`.

### `User`

- `id` (PK)
- `email` (unique)
- `name`
- `passwordHash`
- `role` (`CANDIDATE`, `ADMIN`, `PROCTOR`)
- `isActive`
- `createdAt`, `updatedAt`

### `Exam`

- `id` (PK)
- `title`, `instructions`
- `status` (`DRAFT`, `PUBLISHED`, `ARCHIVED`)
- `durationMinutes`
- `startsAt`, `endsAt`
- `createdByUserId`
- `randomizeQuestions`
- `createdAt`, `updatedAt`

### `ExamAssignment`

- `id` (PK)
- `examId` (FK -> `Exam.id`)
- `candidateId` (FK -> `User.id`)
- `assignedAt`
- Unique: `(examId, candidateId)`

### `Question`

- `id` (PK)
- `examId` (FK)
- `type` (`MCQ`, `CODING`, `SUBJECTIVE`)
- `prompt`
- `optionsJson`
- `answerKeyJson`
- `points`
- `orderIndex`
- `createdAt`

### `Session`

- `id` (PK)
- `examId` (FK)
- `candidateId` (FK)
- `status` (`STARTED`, `SUBMITTED`, `AUTO_SUBMITTED`, `TERMINATED`)
- `reviewDecision` (`PENDING`, `APPROVED`, `REJECTED`)
- `startedAt`, `expiresAt`, `submittedAt`
- `autoScore`, `violationScore`
- `deviceFingerprint`, `ipAddress`
- `webrtcRoomId`
- `candidateSocketId`, `mobileSocketId`, `mobilePairedAt`
- Indexes: `(examId, candidateId)`, `(status)`

### `Answer`

- `id` (PK)
- `sessionId` (FK)
- `questionId` (FK)
- `answerType`
- `responseJson`
- `latencyMs`
- `createdAt`, `updatedAt`
- Unique: `(sessionId, questionId)`

### `Score`

- `id` (PK)
- `sessionId` (FK unique)
- `objectiveScore`, `subjectiveScore`, `finalScore`
- `gradedAt`

### `AdminAction`

- `id` (PK)
- `sessionId` (FK)
- `actorId` (FK -> `User.id`)
- `actionType`
- `reason`
- `payloadJson`
- `createdAt`

### `RefreshSession`

- `id` (PK)
- `userId` (FK)
- `tokenJti` (unique)
- `deviceFingerprint`, `ipAddress`
- `expiresAt`, `revokedAt`, `createdAt`
- Index: `(userId, expiresAt)`

## Event Store (MongoDB)

Collection: `ProctoringEvent`

- `sessionId` (index)
- `examId` (index)
- `candidateId` (index)
- `source` (`LAPTOP`, `MOBILE`, `SYSTEM`)
- `eventType` (index)
- `severity` (1-10)
- `timestamp` (index)
- `meta` (dynamic payload)
- `frameRef` (optional encrypted artifact ref)
- `createdAt`, `updatedAt`

## Redis Keys

- `refresh:{jti}` -> refresh session metadata
- `pairing:{token}` -> one-time mobile pairing state
- `mobile-device:{sessionId}` -> paired mobile fingerprint metadata
- `heartbeat:{sessionId}:{role}` -> liveness markers
