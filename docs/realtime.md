# Real-Time Architecture (WebSockets)

NEXUS provides real-time updates through Socket.IO.

## Connection
Connect to the API URL and pass the JWT in the `auth` payload:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});
```

## Subscribing to Jobs
Clients must explicitly subscribe to a job to receive updates.

**Emit:**
```javascript
socket.emit('subscribeToJob', { jobId: '123' });
```

The server will authorize the request and place the socket into the `job:123` room.

## Event Contract

### 1. Snapshot (`job.snapshot`)
Fired immediately upon successful subscription to allow clients to recover the current state.
```json
{
  "jobId": "...",
  "status": "PROCESSING",
  "progress": 60,
  "updatedAt": "2023-10-24T12:00:00Z"
}
```

### 2. State Changes (`job.started`, `job.completed`, `job.failed`)
Fired when the job transitions states.
```json
{
  "jobId": "...",
  "status": "COMPLETED",
  "resultAvailable": true,
  "completedAt": "2023-10-24T12:05:00Z",
  "updatedAt": "2023-10-24T12:05:00Z"
}
```

### 3. Progress (`job.progress`)
Fired when the worker updates execution progress (0-100).
```json
{
  "jobId": "...",
  "status": "PROCESSING",
  "progress": 42,
  "updatedAt": "2023-10-24T12:02:00Z"
}
```

### 4. Logs (`job.log`)
Fired when the worker emits a log line.
```json
{
  "jobId": "...",
  "message": "Initializing processing environment",
  "timestamp": "2023-10-24T12:00:05Z"
}
```

## Resilience & Ordering
- **Duplicate Handling**: Clients may receive duplicate events. Update the UI based on idempotency or monotonically increasing `updatedAt` timestamps.
- **Disconnects**: If a socket disconnects, the frontend should reconnect and immediately re-emit `subscribeToJob`. The server will reply with `job.snapshot` containing the latest state, allowing seamless recovery.
