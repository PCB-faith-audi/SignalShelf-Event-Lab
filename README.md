SignalShelf Event Lab
Meridian Pivot — Asynchronous Badge Printing Backend

SignalShelf Event Lab is a backend integration and reliability learning project built with Node.js, Express, Redis, BullMQ, HMAC-SHA256, and Git.

The project evolved from a simple HTTP/in-memory prototype into an asynchronous check-in workflow in which badge printing is accepted as background work, tracked with a correlation ID, processed through Redis/BullMQ, and completed through an authenticated webhook.

Final status: Backend implementation completed and verified through end-to-end tests, retry testing, duplicate protection, correlation checks, shared Redis configuration, graceful shutdown, and Git verification.

1. Meridian Pivot

The key architectural pivot was from a synchronous/mock printer flow to an asynchronous integration:

Client
  |
  | POST /check-in/:attendeeId
  v
Express API
  |
  | create jobId + mark PENDING
  v
BullMQ Queue
  |
  v
Redis
  |
  v
BullMQ Worker
  |
  | HMAC-signed completion event
  v
POST /webhooks/print-complete
  |
  | verify signature + validate + correlate job
  v
CHECKED_IN

The central lesson is that PENDING is a real business state. A successful API request does not mean the badge has already printed.

2. Why the Pivot Matters

The earlier implementation could demonstrate an integration, but it did not model delayed external work strongly enough. The Meridian Pivot introduced the reliability requirements that matter when integrations become asynchronous:

Generate a durable correlation identifier (jobId).
Track the attendee's business state.
Accept work before it is complete.
Process printing asynchronously.
Authenticate external callbacks.
Correlate a callback with the original job.
Handle duplicate requests/events safely.
Retry transient queue failures.
Keep failed jobs observable.
Make operational failures visible rather than silently checking people in.

3. Final Technology Stack

Area Technology
Runtime Node.js 20.20.2
API Express 5.2.1
Queue BullMQ 6.1.2
Redis client ioredis 6.0.0
Broker/queue backend Redis
Authentication HMAC-SHA256
Environment config dotenv 17.4.2
Version control Git/GitHub
Module system ES Modules

Redis was verified with redis-cli ping, returning PONG.

4. Project Structure

Important final/backend files:

signalshelf-event-lab/
├── attendees.js
├── index.js
├── redis-config.js
├── redis-queue.js
├── redis-worker.js
├── generate-print-signature.js
├── generate-signature.js
├── hmac-lab.js
├── poller.js
├── polling-lab.js
├── warehouse.js
├── printer-vendor.js
├── vendor-server.js
├── README.md
├── LEARNING.md
├── package.json
├── package-lock.json
└── .gitignore

The polling/vendor files remain as historical learning artifacts from earlier stages. The final active printing path is Redis + BullMQ + the signed completion webhook.

5. API Contract

GET /

Basic health-style response:

Hello SignalShelf

GET /attendees/:attendeeId

Returns the current attendee record.

Example:

{
  "id": "ATT-001",
  "name": "Amina Hassan",
  "status": "CHECKED_IN",
  "jobId": "..."
}

POST /check-in/:attendeeId

Creates an asynchronous print request.

Successful acceptance:

202 Accepted

{
  "message": "Print request queued",
  "attendeeId": "ATT-001",
  "jobId": "<uuid>",
  "status": "PENDING"
}

The endpoint returns 202, not 200, because the print operation has been accepted but is not necessarily complete.

Duplicate/in-progress request: 409 Conflict
Unknown attendee: 404 Not Found
Queue failure: 503 Service Unavailable

When queue submission fails, the attendee is rolled back to NOT_CHECKED_IN and its jobId is cleared.

POST /webhooks/print-complete

Expected headers:

Content-Type: application/json
x-webhook-signature: <HMAC-SHA256 hex>

Expected body:

{
  "jobId": "<uuid>",
  "attendeeId": "ATT-001",
  "status": "completed"
}

Successful completion: 200 OK
Invalid signature: 401 Unauthorized
Invalid completion payload: 400 Bad Request
Unknown attendee: 404 Not Found
Wrong job/attendee correlation: 409 Conflict

Repeated completion after the attendee is already checked in is treated idempotently and returns 200 OK rather than applying the transition again.

6. State Machine

NOT_CHECKED_IN
      |
      | POST /check-in/:attendeeId
      v
   PENDING
      |
      | valid signed completion + matching jobId
      v
 CHECKED_IN

Invalid transitions are rejected.

For example:

CHECKED_IN -- POST /check-in again --> 409 Conflict
PENDING -- POST /check-in again ----> 409 Conflict
wrong job completion ---------------> 409 Conflict
invalid signature -------------------> 401 Unauthorized

7. HMAC Webhook Security

The API does not trust the completion webhook simply because it reached the endpoint.

The worker signs the exact JSON payload using the shared WEBHOOK_SECRET:

HMAC-SHA256(secret, exact-payload)

The API captures the raw request body before JSON parsing and recalculates the expected signature.

The comparison uses crypto.timingSafeEqual after checking equal buffer lengths.

This protects the state transition from unauthenticated callbacks.

Secret handling

The project uses .env for WEBHOOK_SECRET and .gitignore contains:

node_modules/
.env

git ls-files .env returned no tracked .env, confirming the secret file was not committed.

8. Redis + BullMQ Queue

The final queue is named:

print-jobs

Jobs use the name:

print-badge

Job data:

{
  "jobId": "<uuid>",
  "attendeeId": "ATT-001"
}

The final queue policy uses:

attempts: 3
fixed backoff of 1000ms
removeOnComplete: true
removeOnFail: false

This means successful jobs can be removed automatically while failed jobs remain observable.

9. Shared Redis Configuration

redis-config.js centralizes the Redis connection:

export const redisConnection = {
    host: '127.0.0.1',
    port: 6379
};

Both the queue and worker import the same configuration. This eliminated duplicated connection settings and reduced configuration drift.

10. Worker Behavior

The BullMQ worker:

Receives a print-badge job.
Reads jobId and attendeeId.
Creates a completion event.
Serializes the exact payload.
Generates an HMAC signature.
POSTs the signed event to /webhooks/print-complete.
Throws an error when the webhook response is not successful.
Lets BullMQ apply the retry policy.
Reports completed/failed jobs through worker events.

Observed successful worker output included:

Worker processing print job: ...
Webhook completed: 200 ...
BullMQ job 3 completed successfully

11. Reliability Tests Completed

Redis availability

redis-cli ping
PONG

Syntax validation

The following were checked successfully:

node --check index.js
node --check redis-config.js
node --check redis-queue.js
node --check redis-worker.js

End-to-end check-in

A check-in returned:

202 Accepted
status: PENDING

The worker then completed the signed callback and the attendee became:

CHECKED_IN

Three-attendee verification

ATT-001, ATT-002, and ATT-003 were successfully queued and observed as CHECKED_IN after processing.

Duplicate check-in

A second check-in for an already checked-in attendee returned:

409 Conflict

with:

{
  "error": "Attendee already has a check-in in progress or is already checked in",
  "status": "CHECKED_IN"
}

Duplicate completion

The same valid completion event was sent twice. Both returned 200 OK, with the second response reporting:

Check-in already confirmed

This demonstrated idempotent completion handling.

Wrong job correlation

A deliberately incorrect job ID (WRONG-JOB-999) was signed correctly and submitted for ATT-002.

The server returned:

409 Conflict

and the attendee remained checked in with its legitimate job ID.

This was an important distinction: a correctly signed event can still be invalid for the business operation it claims to complete.

Retry test

A temporary retry worker deliberately failed every attempt.

Observed:

Processing attempt 1 for job 1
Job 1 failed. Attempts made: 1.
Processing attempt 2 for job 1
Job 1 failed. Attempts made: 2.
Processing attempt 3 for job 1
Job 1 failed. Attempts made: 3.

The temporary test worker was then deleted.

Graceful worker shutdown

The worker responded to SIGINT:

Received SIGINT. Shutting down worker...
BullMQ worker closed successfully

Graceful API shutdown

The API responded to SIGINT:

Received SIGINT. Shutting down API server...
HTTP server closed successfully

12. Important Bugs and Lessons

ESM one-liner failure

A command attempted to combine import syntax inside a Node evaluation context and produced:

SyntaxError: Unexpected identifier 'crypto'

The lesson was to avoid fragile ad-hoc evaluation for repeatable workflows. The reusable generate-print-signature.js utility was changed to accept:

node generate-print-signature.js <jobId> <attendeeId>

This made signature generation deterministic and reusable.

Wrong payload signature

A signature generated for one payload cannot authenticate a different payload. The testing process made this visible and reinforced that HMAC protects the exact message, not merely the endpoint.

Server-not-running confusion

Several tests produced:

curl: (7) Failed to connect to localhost port 3000

The root cause was that the Express API process was not running at the time of the curl command. This reinforced an operational lesson: API, worker, and Redis are separate runtime components and must be considered separately when troubleshooting.

Command concatenation

Some shell tests were pasted without separators, producing commands that visually ran together, for example multiple curl commands appearing on the same prompt line. The server correctly processed the valid requests, but the output became harder to read.

Lesson: use separate lines or explicit shell separators when collecting evidence.

Documentation drift

A search found historical references to in-memory, printer-vendor, and vendor-server. These were retained as learning history rather than pretending the original architecture never existed. The final active architecture is Redis/BullMQ.

README historical limitation

The README still contained an older statement about in-memory storage. This is an architectural documentation issue rather than a failure of the final queue. The attendee store is still in memory, while the print queue itself is Redis-backed. Production documentation should distinguish those two facts clearly.

13. What Is Actually Production-Ready vs Prototype

Stronger final components

Asynchronous queue architecture
Redis-backed queue
BullMQ retry policy
HMAC webhook authentication
Raw-body verification
Timing-safe signature comparison
Job correlation
Duplicate protection
Idempotent completion
Queue failure rollback
Graceful shutdown
Shared Redis configuration
Git audit trail

Remaining prototype limitations

Attendees are stored in an in-memory JavaScript object.
There is no persistent attendee database.
The printer is represented by a worker rather than a real hardware/vendor integration.
One shared webhook secret is used.
No API authentication/authorization layer is present.
No rate limiting is implemented.
No production metrics/tracing stack is present.
No dead-letter workflow has been implemented.
No persistent audit database is present.

The correct engineering conclusion is therefore: the asynchronous backend pattern is demonstrated strongly, but the entire service is not yet a production deployment.

14. Production Roadmap

Replace the attendee object with PostgreSQL or another durable database.
Add transactions/locking for check-in state changes.
Use managed Redis with TLS, authentication, monitoring, and backups.
Move secrets to a secrets manager.
Add API authentication and authorization.
Add rate limiting and request validation.
Add structured logs, metrics, tracing, and alerts.
Add a dead-letter/failure workflow after retry exhaustion.
Add webhook timestamp/replay protection.
Add automated unit/integration/end-to-end tests.
Deploy API and worker as independently managed services
Add operational runbooks for recovery and incident handling.

15. Git Milestones

The final development history included:

646df52 feat: finalize SignalShelf backend
aaa24a1 docs: document Day 6 reliability verification
521dc53 refactor: make webhook signature generator reusable
976c572 feat: migrate print queue to Redis and BullMQ
c2b5d23 feat: complete async badge printing pivot
173036d feat: complete async badge printing pivot
b0ca110 feat: add polling change detection
1ed97b0 feat: add warehouse polling integration

Final repository state:

On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean

16. Final Takeaway

SignalShelf started as a small integration exercise and became a practical lesson in asynchronous backend engineering.

The most important change was not Redis itself. It was the architectural shift in thinking:

Accept work, track it, authenticate its completion, correlate it, retry failures, and make every important state transition observable.

That is the core lesson of the Meridian Pivot.
# SignalShelf Event Lab

## Meridian Pivot — Asynchronous Badge Printing Backend

SignalShelf Event Lab is a backend integration and reliability learning project built with **Node.js, Express, Redis, BullMQ, HMAC-SHA256, and Git**.

The project evolved from a simple HTTP/in-memory prototype into an asynchronous check-in workflow in which badge printing is accepted as background work, tracked with a correlation ID, processed through Redis/BullMQ, and completed through an authenticated webhook.

> **Final status:** Backend implementation completed and verified through end-to-end tests, retry testing, duplicate protection, correlation checks, shared Redis configuration, graceful shutdown, and Git verification.

---

## 1. Meridian Pivot

The key architectural pivot was from a synchronous/mock printer flow to an asynchronous integration:

```text
Client
  |
  | POST /check-in/:attendeeId
  v
Express API
  |
  | create jobId + mark PENDING
  v
BullMQ Queue
  |
  v
Redis
  |
  v
BullMQ Worker
  |
  | HMAC-signed completion event
  v
POST /webhooks/print-complete
  |
  | verify signature + validate + correlate job
  v
CHECKED_IN
```

The central lesson is that **PENDING is a real business state**. A successful API request does not mean the badge has already printed.

---

## 2. Why the Pivot Matters

The earlier implementation could demonstrate an integration, but it did not model delayed external work strongly enough. The Meridian Pivot introduced the reliability requirements that matter when integrations become asynchronous:

1. Generate a durable correlation identifier (`jobId`).
2. Track the attendee's business state.
3. Accept work before it is complete.
4. Process printing asynchronously.
5. Authenticate external callbacks.
6. Correlate a callback with the original job.
7. Handle duplicate requests/events safely.
8. Retry transient queue failures.
9. Keep failed jobs observable.
10. Make operational failures visible rather than silently checking people in.

---

## 3. Final Technology Stack

| Area | Technology |
|---|---|
| Runtime | Node.js 20.20.2 |
| API | Express 5.2.1 |
| Queue | BullMQ 6.1.2 |
| Redis client | ioredis 6.0.0 |
| Broker/queue backend | Redis |
| Authentication | HMAC-SHA256 |
| Environment config | dotenv 17.4.2 |
| Version control | Git/GitHub |
| Module system | ES Modules |

Redis was verified with `redis-cli ping`, returning `PONG`.

---

## 4. Project Structure

Important final/backend files:

```text
signalshelf-event-lab/
├── attendees.js
├── index.js
├── redis-config.js
├── redis-queue.js
├── redis-worker.js
├── generate-print-signature.js
├── generate-signature.js
├── hmac-lab.js
├── poller.js
├── polling-lab.js
├── warehouse.js
├── queue.js
├── printer-vendor.js
├── vendor-server.js
├── README.md
├── LEARNING.md
├── package.json
├── package-lock.json
└── .gitignore
```

The polling/vendor files remain as historical learning artifacts from earlier stages. The **final active printing path is Redis + BullMQ + the signed completion webhook**.

---

## 5. API Contract

### `GET /`

Basic health-style response:

```text
Hello SignalShelf
```

### `GET /attendees/:attendeeId`

Returns the current attendee record.

Example:

```json
{
  "id": "ATT-001",
  "name": "Amina Hassan",
  "status": "CHECKED_IN",
  "jobId": "..."
}
```

### `POST /check-in/:attendeeId`

Creates an asynchronous print request.

Successful acceptance:

```http
202 Accepted
```

```json
{
  "message": "Print request queued",
  "attendeeId": "ATT-001",
  "jobId": "<uuid>",
  "status": "PENDING"
}
```

The endpoint returns **202**, not 200, because the print operation has been accepted but is not necessarily complete.

Duplicate/in-progress request:

```http
409 Conflict
```

Unknown attendee:

```http
404 Not Found
```

Queue failure:

```http
503 Service Unavailable
```

When queue submission fails, the attendee is rolled back to `NOT_CHECKED_IN` and its `jobId` is cleared.

### `POST /webhooks/print-complete`

Expected headers:

```text
Content-Type: application/json
x-webhook-signature: <HMAC-SHA256 hex>
```

Expected body:

```json
{
  "jobId": "<uuid>",
  "attendeeId": "ATT-001",
  "status": "completed"
}
```

Successful completion:

```http
200 OK
```

Invalid signature:

```http
401 Unauthorized
```

Invalid completion payload:

```http
400 Bad Request
```

Unknown attendee:

```http
404 Not Found
```

Wrong job/attendee correlation:

```http
409 Conflict
```

Repeated completion after the attendee is already checked in is treated idempotently and returns `200 OK` rather than applying the transition again.

---

## 6. State Machine

```text
NOT_CHECKED_IN
      |
      | POST /check-in/:attendeeId
      v
   PENDING
      |
      | valid signed completion + matching jobId
      v
 CHECKED_IN
```

Invalid transitions are rejected.

For example:

```text
CHECKED_IN -- POST /check-in again --> 409 Conflict
PENDING -- POST /check-in again ----> 409 Conflict
wrong job completion ---------------> 409 Conflict
invalid signature ------------------> 401 Unauthorized
```

---

## 7. HMAC Webhook Security

The API does not trust the completion webhook simply because it reached the endpoint.

The worker signs the exact JSON payload using the shared `WEBHOOK_SECRET`:

```text
HMAC-SHA256(secret, exact-payload)
```

The API captures the raw request body before JSON parsing and recalculates the expected signature.

The comparison uses `crypto.timingSafeEqual` after checking equal buffer lengths.

This protects the state transition from unauthenticated callbacks.

### Secret handling

The project uses `.env` for `WEBHOOK_SECRET` and `.gitignore` contains:

```text
node_modules/
.env
```

`git ls-files .env` returned no tracked `.env`, confirming the secret file was not committed.

---

## 8. Redis + BullMQ Queue

The final queue is named:

```text
print-jobs
```

Jobs use the name:

```text
print-badge
```

Job data:

```json
{
  "jobId": "<uuid>",
  "attendeeId": "ATT-001"
}
```

The final queue policy uses:

- `attempts: 3`
- fixed backoff of `1000ms`
- `removeOnComplete: true`
- `removeOnFail: false`

This means successful jobs can be removed automatically while failed jobs remain observable.

---

## 9. Shared Redis Configuration

`redis-config.js` centralizes the Redis connection:

```js
export const redisConnection = {
    host: '127.0.0.1',
    port: 6379
};
```

Both the queue and worker import the same configuration. This eliminated duplicated connection settings and reduced configuration drift.

---

## 10. Worker Behavior

The BullMQ worker:

1. Receives a `print-badge` job.
2. Reads `jobId` and `attendeeId`.
3. Creates a completion event.
4. Serializes the exact payload.
5. Generates an HMAC signature.
6. POSTs the signed event to `/webhooks/print-complete`.
7. Throws an error when the webhook response is not successful.
8. Lets BullMQ apply the retry policy.
9. Reports completed/failed jobs through worker events.

Observed successful worker output included:

```text
Worker processing print job: ...
Webhook completed: 200 ...
BullMQ job 3 completed successfully
```

---

## 11. Reliability Tests Completed

### Redis availability

```text
redis-cli ping
PONG
```

### Syntax validation

The following were checked successfully:

```text
node --check index.js
node --check redis-config.js
node --check redis-queue.js
node --check redis-worker.js
```

### End-to-end check-in

A check-in returned:

```text
202 Accepted
status: PENDING
```

The worker then completed the signed callback and the attendee became:

```text
CHECKED_IN
```

### Three-attendee verification

ATT-001, ATT-002, and ATT-003 were successfully queued and observed as `CHECKED_IN` after processing.

### Duplicate check-in

A second check-in for an already checked-in attendee returned:

```text
409 Conflict
```

with:

```json
{
  "error": "Attendee already has a check-in in progress or is already checked in",
  "status": "CHECKED_IN"
}
```

### Duplicate completion

The same valid completion event was sent twice. Both returned `200 OK`, with the second response reporting:

```text
Check-in already confirmed
```

This demonstrated idempotent completion handling.

### Wrong job correlation

A deliberately incorrect job ID (`WRONG-JOB-999`) was signed correctly and submitted for ATT-002.

The server returned:

```text
409 Conflict
```

and the attendee remained checked in with its legitimate job ID.

This was an important distinction: **a correctly signed event can still be invalid for the business operation it claims to complete.**

### Retry test

A temporary retry worker deliberately failed every attempt.

Observed:

```text
Processing attempt 1 for job 1
Job 1 failed. Attempts made: 1.
Processing attempt 2 for job 1
Job 1 failed. Attempts made: 2.
Processing attempt 3 for job 1
Job 1 failed. Attempts made: 3.
```

The temporary test worker was then deleted.

### Graceful worker shutdown

The worker responded to SIGINT:

```text
Received SIGINT. Shutting down worker...
BullMQ worker closed successfully
```

### Graceful API shutdown

The API responded to SIGINT:

```text
Received SIGINT. Shutting down API server...
HTTP server closed successfully
```

---

## 12. Important Bugs and Lessons

### ESM one-liner failure

A command attempted to combine `import` syntax inside a Node evaluation context and produced:

```text
SyntaxError: Unexpected identifier 'crypto'
```

The lesson was to avoid fragile ad-hoc evaluation for repeatable workflows. The reusable `generate-print-signature.js` utility was changed to accept:

```text
node generate-print-signature.js <jobId> <attendeeId>
```

This made signature generation deterministic and reusable.

### Wrong payload signature

A signature generated for one payload cannot authenticate a different payload. The testing process made this visible and reinforced that HMAC protects the exact message, not merely the endpoint.

### Server-not-running confusion

Several tests produced:

```text
curl: (7) Failed to connect to localhost port 3000
```

The root cause was that the Express API process was not running at the time of the curl command. This reinforced an operational lesson: API, worker, and Redis are separate runtime components and must be considered separately when troubleshooting.

### Command concatenation

Some shell tests were pasted without separators, producing commands that visually ran together, for example multiple `curl` commands appearing on the same prompt line. The server correctly processed the valid requests, but the output became harder to read.

Lesson: use separate lines or explicit shell separators when collecting evidence.

### Documentation drift

A search found historical references to `in-memory`, `printer-vendor`, and `vendor-server`. These were retained as learning history rather than pretending the original architecture never existed. The final active architecture is Redis/BullMQ.

### README historical limitation

The README still contained an older statement about in-memory storage. This is an architectural documentation issue rather than a failure of the final queue. The attendee store is still in memory, while the **print queue itself is Redis-backed**. Production documentation should distinguish those two facts clearly.

---

## 13. What Is Actually Production-Ready vs Prototype

### Stronger final components

- Asynchronous queue architecture
- Redis-backed queue
- BullMQ retry policy
- HMAC webhook authentication
- Raw-body verification
- Timing-safe signature comparison
- Job correlation
- Duplicate protection
- Idempotent completion
- Queue failure rollback
- Graceful shutdown
- Shared Redis configuration
- Git audit trail

### Remaining prototype limitations

- Attendees are stored in an in-memory JavaScript object.
- There is no persistent attendee database.
- The printer is represented by a worker rather than a real hardware/vendor integration.
- One shared webhook secret is used.
- No API authentication/authorization layer is present.
- No rate limiting is implemented.
- No production metrics/tracing stack is present.
- No dead-letter workflow has been implemented.
- No persistent audit database is present.

The correct engineering conclusion is therefore: **the asynchronous backend pattern is demonstrated strongly, but the entire service is not yet a production deployment.**

---

## 14. Production Roadmap

1. Replace the attendee object with PostgreSQL or another durable database.
2. Add transactions/locking for check-in state changes.
3. Use managed Redis with TLS, authentication, monitoring, and backups.
4. Move secrets to a secrets manager.
5. Add API authentication and authorization.
6. Add rate limiting and request validation.
7. Add structured logs, metrics, tracing, and alerts.
8. Add a dead-letter/failure workflow after retry exhaustion.
9. Add webhook timestamp/replay protection.
10. Add automated unit/integration/end-to-end tests.
11. Deploy API and worker as independently managed services.
12. Add operational runbooks for recovery and incident handling.

---

## 15. Git Milestones

The final development history included:

```text
646df52 feat: finalize SignalShelf backend
aaa24a1 docs: document Day 6 reliability verification
521dc53 refactor: make webhook signature generator reusable
976c572 feat: migrate print queue to Redis and BullMQ
c2b5d23 feat: complete async badge printing pivot
173036d feat: complete async badge printing pivot
b0ca110 feat: add polling change detection
1ed97b0 feat: add warehouse polling integration
```

Final repository state:

```text
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

---

## 16. Final Takeaway

SignalShelf started as a small integration exercise and became a practical lesson in asynchronous backend engineering.

The most important change was not Redis itself. It was the architectural shift in thinking:

> **Accept work, track it, authenticate its completion, correlate it, retry failures, and make every important state transition observable.**

That is the core lesson of the Meridian Pivot.
