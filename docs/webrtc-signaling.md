# WebRTC Signaling Contract

Socket.IO path: `/ws`

## Authentication

- Candidate/Admin use access JWT via `auth.token` at socket connect.
- Mobile uses `mobileSessionJwt` from `/api/v1/pairing/claim`.

## Room Join

Client emits:

```json
{ "event": "join-room", "data": { "sessionId": "sess_123", "role": "candidate|mobile|admin" } }
```

Server emits:

- `joined-room`
- `mobile-paired` when mobile joins

## Signaling Events

### Offer

Emit:

```json
{
  "event": "webrtc-offer",
  "data": {
    "sessionId": "sess_123",
    "source": "laptop|mobile|screen",
    "sdp": "v=0..."
  }
}
```

Receive:

```json
{
  "sessionId": "sess_123",
  "fromSocketId": "socket_1",
  "source": "laptop|mobile|screen",
  "sdp": "v=0..."
}
```

### Answer

Emit:

```json
{
  "event": "webrtc-answer",
  "data": {
    "sessionId": "sess_123",
    "source": "laptop|mobile|screen",
    "sdp": "v=0..."
  }
}
```

### ICE Candidate

Emit:

```json
{
  "event": "webrtc-ice",
  "data": {
    "sessionId": "sess_123",
    "source": "laptop|mobile|screen",
    "candidate": {
      "candidate": "candidate:...",
      "sdpMLineIndex": 0,
      "sdpMid": "0"
    }
  }
}
```

### Republish Trigger

Admin emits when joining late:

```json
{
  "event": "request-republish",
  "data": { "sessionId": "sess_123" }
}
```

Candidate/mobile receive `republish-request` and renegotiate by sending fresh offers.

## Heartbeat

Every 5s:

```json
{
  "event": "heartbeat",
  "data": { "sessionId": "sess_123", "role": "candidate|mobile" }
}
```

Server returns `heartbeat-ack`.
