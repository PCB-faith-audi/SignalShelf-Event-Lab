# SignalShelf Event Lab — Final Learning Journal

## Days 1–7: Complete Journey from Initial Integration to the Meridian Pivot

**Finalized: 21 August 2026**

---

## 1. Purpose of This Journal

This journal records the complete engineering learning journey behind SignalShelf Event Lab, including the early integration experiments, the Meridian Pivot, webhook security, asynchronous job processing, Redis/BullMQ migration, reliability testing, bugs, debugging lessons, and final backend verification.

The purpose is not merely to list commands that worked. It is to explain **why the architecture changed, what failed, how it was diagnosed, and what each failure taught us about backend engineering.**

---

## 2. The Original Problem

The project started around an event/integration scenario where an attendee check-in could trigger badge printing. The early prototype used simple application state and mock/in-memory components.

The first architecture was useful for understanding:

- HTTP endpoints
- external integration concepts
- polling
- webhooks
- basic state changes
- request/response behavior

But it did not fully represent what happens when badge printing is slow, asynchronous, unavailable, duplicated, or completed later by another system.

That gap became the reason for the Meridian Pivot.

---

## 3. Early Polling Work

The project explored warehouse/resource polling before the final badge-printing architecture.

The polling work established the idea of checking an external source for changes and reacting to them. It demonstrated a valid integration pattern, but also exposed its natural limitations:

- the application must repeatedly ask for changes
- changes can be detected only on a polling cycle
- polling introduces unnecessary reads
- latency depends on the polling interval
- state synchronization becomes a concern

This was valuable because it created the conceptual contrast for webhooks: instead of repeatedly asking whether something happened, an external system can notify the application when it happens.

---

## 4. Webhook Fundamentals

The next stage introduced the completion webhook.

The conceptual flow became:

```text
Application requests work
        ↓
External process performs work
        ↓
External process sends completion event
        ↓
Application validates the event
        ↓
Application updates state
```

The important discovery was that a webhook is not automatically trustworthy just because it reached a known URL.

That led to HMAC authentication.

---

## 5. HMAC-SHA256 Learning

The project implemented HMAC-SHA256 using Node's `crypto` module.

The signing principle is:

```text
signature = HMAC-SHA256(WEBHOOK_SECRET, exact_payload)
```

The worker signs the payload. The API independently calculates the expected signature and compares it to the received `x-webhook-signature` header.

### Why the raw body mattered

The Express JSON parser turns bytes into a JavaScript object. If the API later serializes the object itself, the byte representation could differ from what was originally signed.

Therefore the API captured the raw body using Express middleware's `verify` hook.

The verification sequence became:

1. Receive raw request bytes.
2. Read `x-webhook-signature`.
3. Calculate the expected HMAC over the raw body.
4. Compare signatures safely.
5. Only then process the state transition.

### Timing-safe comparison

The final verifier used `crypto.timingSafeEqual` after checking equal lengths.

This was a useful security lesson: correctness is not only about calculating the same hash; the comparison method also matters.

---

## 6. The Meridian Pivot

The project then made its most important architectural change.

The earlier print flow treated printing too much like a normal synchronous operation. The Meridian Pivot changed the business model:

```text
PENDING
```

became a real state.

A check-in request means:

> The system accepted a print job.

It does **not** mean:

> The badge is already printed.

This distinction led to the final asynchronous design.

---

## 7. The New State Model

The final attendee states were:

```text
NOT_CHECKED_IN
        |
        | request accepted
        v
     PENDING
        |
        | valid completion
        v
   CHECKED_IN
```

This made the system easier to reason about.

### Why PENDING matters

Without `PENDING`, the API might have only two choices:

```text
NOT_CHECKED_IN
CHECKED_IN
```

That would encourage the dangerous assumption that accepting a print request means printing succeeded.

With `PENDING`, the application can truthfully represent work that is in progress.

---

## 8. Durable Correlation IDs

Every check-in creates a UUID:

```js
const jobId = crypto.randomUUID();
```

That ID is stored with the attendee and sent into the queue.

The completion webhook must provide the same `jobId`.

The backend checks:

```text
attendee.jobId === webhook.jobId
```

If the IDs do not match, the callback is rejected.

This is one of the most important lessons from the project:

> Authentication proves that a sender knows the shared secret. Correlation proves that the message belongs to this specific operation.

You need both.

---

## 9. Why HTTP 202 Was Correct

The check-in endpoint eventually returned:

```text
202 Accepted
```

with:

```json
{
  "message": "Print request queued",
  "attendeeId": "ATT-001",
  "jobId": "...",
  "status": "PENDING"
}
```

This is more semantically accurate than returning a successful completion response.

The API has accepted responsibility for processing the work, but the final operation is still pending.

This was an important REST/API design lesson.

---

## 10. Queue Failure Rollback

The API updates the attendee before queueing:

```text
NOT_CHECKED_IN → PENDING
```

But queue submission can fail.

The final implementation catches queue errors and rolls the attendee back:

```text
PENDING → NOT_CHECKED_IN
jobId → null
```

Then it returns:

```text
503 Service Unavailable
```

This prevents a dangerous state where the application claims that work is pending even though the job was never successfully accepted by the queue.

That was a strong reliability lesson:

> State should reflect what the system actually knows happened.

---

## 11. Moving from In-Memory Queue to Redis/BullMQ

The earlier queue was an in-memory JavaScript queue.

Its limitations were clear:

- queue data could disappear when the process stopped
- no real broker was involved
- retry behavior was not representative of a production queue
- API and worker could not depend on a shared durable queue backend

The project therefore migrated to:

```text
BullMQ + Redis
```

### Final queue architecture

```text
Express API
     ↓
BullMQ Queue
     ↓
Redis
     ↓
BullMQ Worker
```

This preserved the existing application-level job contract while replacing the queue implementation underneath it.

---

## 12. BullMQ Configuration

The final queue was named:

```text
print-jobs
```

The job type was:

```text
print-badge
```

The queue was configured with:

```text
attempts: 3
backoff: fixed, 1000 ms
removeOnComplete: true
removeOnFail: false
```

The design means:

- transient failures get another chance
- retries do not happen forever
- successful jobs can be cleaned up
- failed jobs remain visible for investigation

This is much closer to real asynchronous integration behavior.

---

## 13. Redis Verification

Redis was repeatedly checked with:

```text
redis-cli ping
```

and returned:

```text
PONG
```

Dependency verification showed:

```text
bullmq@6.1.2
ioredis@6.0.0
```

This gave confidence that the queue's runtime dependencies were actually installed and available.

---

## 14. Shared Redis Configuration

A new `redis-config.js` was introduced:

```js
export const redisConnection = {
    host: '127.0.0.1',
    port: 6379
};
```

Both the queue and worker imported it.

Before this change, Redis connection configuration existed in multiple places. Centralizing it improved consistency and maintainability.

The change was verified using:

```text
node --check redis-config.js
node --check redis-queue.js
node --check redis-worker.js
```

and a module-load test confirmed:

```text
Redis configuration loaded successfully
```

---

## 15. Worker Design

The final worker consumes the `print-jobs` queue.

For every job it creates:

```json
{
  "jobId": "<original job ID>",
  "attendeeId": "<original attendee ID>",
  "status": "completed"
}
```

It serializes that payload, signs it, and sends it to:

```text
POST /webhooks/print-complete
```

If the webhook returns a non-success status, the worker throws an error.

That error tells BullMQ that the job failed, allowing the configured retry behavior to operate.

---

## 16. The Signature Generator Refactor

During testing, the original signature generator contained a fixed payload/secret approach.

It was refactored into a reusable command-line utility.

The new usage became:

```text
node generate-print-signature.js <jobId> <attendeeId>
```

It loads the secret from `.env`, constructs the exact expected payload, and prints the payload and signature.

This was a good example of turning a temporary debugging script into a reusable engineering tool.

---

## 17. Bug: ESM Node One-Liner

One testing attempt used a Node one-liner containing `import` statements and resulted in:

```text
SyntaxError: Unexpected identifier 'crypto'
```

The issue was not with HMAC itself. It was the evaluation context and how the command was being interpreted.

### Lesson

A repeatable script is better than a complicated shell one-liner for security-sensitive test data.

Instead of repeatedly fighting the command environment, the reusable signature generator became the reliable test mechanism.

---

## 18. Bug: API Not Running

At several points a curl command returned:

```text
curl: (7) Failed to connect to localhost port 3000 after 0 ms: Couldn't connect to server
```

The cause was straightforward: the Express process was not running.

The worker can be running while the API is stopped, and Redis can be running while both application processes are stopped.

This produced an important operational lesson:

```text
Redis availability
≠ API availability
≠ Worker availability
```

These are separate runtime dependencies.

---

## 19. Bug: Command Pasting / Concatenated Curl Commands

Some terminal commands were pasted without proper line separation, creating output such as multiple curl commands visually running together.

The backend still processed valid requests, but the evidence became difficult to read.

### Lesson

When performing acceptance tests, reproducibility and readable evidence matter. Commands should be run separately or chained intentionally with clear shell separators.

---

## 20. Wrong-Job Correlation Test

A deliberate failure was created using:

```text
WRONG-JOB-999
```

for ATT-002.

The payload was correctly signed.

The server returned:

```text
409 Conflict
```

This was a particularly valuable test because it demonstrated that signature verification alone is not enough.

The event was authentic according to the shared secret, but it did not belong to ATT-002's current operation.

The attendee remained:

```text
CHECKED_IN
```

with its legitimate job ID.

---

## 21. Duplicate Completion Test

A valid completion event for ATT-002 was submitted twice.

The first completion was already reflected in the attendee state.

The repeated event returned:

```text
200 OK
```

with:

```text
Check-in already confirmed
```

This demonstrated idempotency.

In distributed systems, duplicate delivery is not an unusual edge case. A robust consumer should expect it.

---

## 22. Duplicate Check-In Test

After ATT-001 became `CHECKED_IN`, another:

```text
POST /check-in/ATT-001
```

returned:

```text
409 Conflict
```

The state remained unchanged.

This protected the system from duplicate scans/check-in attempts.

---

## 23. Three-Attendee End-to-End Test

A complete end-to-end test was performed with:

- ATT-001 — Amina Hassan
- ATT-002 — Brian Otieno
- ATT-003 — Carol Wanjiku

All three were successfully queued and eventually became:

```text
CHECKED_IN
```

The test proved that the queue/worker/webhook/state path worked repeatedly, not only for one manually constructed request.

---

## 24. Retry Test

A temporary `retry-test-worker.js` was created specifically to force failures.

The observed sequence was:

```text
Processing attempt 1 for job 1
Job 1 failed. Attempts made: 1.

Processing attempt 2 for job 1
Job 1 failed. Attempts made: 2.

Processing attempt 3 for job 1
Job 1 failed. Attempts made: 3.
```

The test then stopped and the temporary worker was removed.

### Lesson

Retry logic should not be assumed merely because configuration exists. It should be deliberately exercised and observed.

---

## 25. Graceful Worker Shutdown

The worker was started directly and then interrupted with SIGINT.

It produced:

```text
Received SIGINT. Shutting down worker...
BullMQ worker closed successfully
```

This confirmed that the worker has explicit shutdown handling.

Graceful shutdown is important for deployments, restarts, maintenance, and avoiding abrupt termination while work is active.

---

## 26. Graceful API Shutdown

The Express server was similarly tested:

```text
Received SIGINT. Shutting down API server...
HTTP server closed successfully
```

This demonstrated that the API can close its HTTP server deliberately.

---

## 27. Syntax and Dependency Verification

The following were checked repeatedly during the final phase:

```text
node --check index.js
node --check redis-config.js
node --check redis-queue.js
node --check redis-worker.js
```

All completed successfully.

Dependency verification:

```text
npm list bullmq ioredis
```

showed:

```text
bullmq@6.1.2
ioredis@6.0.0
```

---

## 28. Environment Secret Verification

`.gitignore` contains:

```text
node_modules/
.env
```

The command:

```text
git ls-files .env
```

returned no tracked `.env` file.

This was important because the webhook secret must not enter source control.

---

## 29. Documentation Drift and Historical Files

A repository search found:

```text
README.md: In-memory storage
LEARNING.md: historical in-memory/vendor references
```

and files such as:

```text
printer-vendor.js
vendor-server.js
queue.js
```

still existed.

These files document earlier learning stages. They should not be confused with the final active print path.

The final active architecture is:

```text
Redis + BullMQ + Worker + HMAC webhook
```

This distinction is important for engineering documentation: historical implementation details can be valuable, but the final architecture must be clearly identified.

---

## 30. A Subtle but Important Limitation

Although the print queue is now Redis-backed, attendee records are still held in an in-memory JavaScript object.

Therefore:

```text
Redis durability
```

does not automatically mean:

```text
Application state durability
```

If the Express process restarts, attendee state can be lost.

This is why the correct final assessment is that the project demonstrates a strong asynchronous backend pattern but remains a learning prototype rather than a fully production-ready service.

---

## 31. Security Lessons

### Authentication is not correlation

A valid HMAC means the event was signed with the shared secret.

It does not mean the event is the right event for the right attendee.

Therefore:

```text
HMAC verification
        +
job correlation
```

are both required.

### Raw-body signing matters

The verifier must calculate the HMAC over the exact payload bytes.

### Secrets must stay outside Git

`.env` is ignored and was confirmed untracked.

### Duplicate events are normal

Webhook consumers should be designed for idempotency.

---

## 32. Reliability Lessons

The project demonstrated the following reliability principles:

### Explicit state

`PENDING` communicates that work exists but is unfinished.

### Correlation

`jobId` ties asynchronous work back to the original business operation.

### Retry

BullMQ retries failed work according to a defined policy.

### Failure visibility

Failed jobs are not automatically removed.

### Idempotency

Repeated completion events do not create repeated state transitions.

### Rollback

If queue submission fails, the API restores the attendee to the pre-request state.

### Graceful shutdown

API and worker processes close cleanly.

---

## 33. Git and Audit Trail

The major Git milestones were:

```text
1ed97b0 feat: add warehouse polling integration
b0ca110 feat: add polling change detection
173036d feat: complete async badge printing pivot
c2b5d23 feat: complete async badge printing pivot
976c572 feat: migrate print queue to Redis and BullMQ
521dc53 refactor: make webhook signature generator reusable
aaa24a1 docs: document Day 6 reliability verification
646df52 feat: finalize SignalShelf backend
```

The final repository verification showed:

```text
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

This is important evidence that the final implementation was committed and pushed rather than left as untracked local work.

---

## 34. Final Architecture Review

### API responsibility

The API:

- validates the attendee
- prevents duplicate/in-progress check-ins
- creates the correlation ID
- marks PENDING
- queues the work
- rolls back on queue failure
- returns 202

### Queue responsibility

BullMQ/Redis:

- accepts the job
- stores queue state
- controls attempts
- applies backoff
- retains failed jobs

### Worker responsibility

The worker:

- consumes jobs
- creates the completion event
- signs the payload
- calls the completion endpoint
- reports success/failure
- participates in retry behavior

### Webhook responsibility

The API's completion endpoint:

- verifies HMAC
- validates required fields
- finds the attendee
- checks job correlation
- handles duplicate completion
- transitions PENDING → CHECKED_IN

This separation of responsibilities is one of the strongest outcomes of the project.

---

## 35. What I Would Improve Next

If this backend were promoted toward production, the next engineering work would be:

1. Persist attendees in PostgreSQL or another durable database.
2. Add transactional state changes.
3. Add API authentication and authorization.
4. Add rate limiting.
5. Use a managed Redis deployment.
6. Add TLS/authentication for Redis connections.
7. Store secrets in a secrets manager.
8. Add webhook timestamps/nonces for replay protection.
9. Add structured logging.
10. Add metrics and distributed tracing.
11. Add dead-letter handling after retry exhaustion.
12. Add automated unit tests.
13. Add integration tests using a test Redis instance/container.
14. Add full end-to-end CI tests.
15. Deploy API and worker independently.
16. Add monitoring and alerting.
17. Create operational runbooks.

---

## 36. Instructor Assessment

From an instructor/backend-engineering perspective, the strongest learning outcomes were not the individual commands. They were the architectural decisions.

### Strong evidence of growth

- The system moved from synchronous assumptions to explicit asynchronous state.
- The learner introduced `jobId` as a correlation mechanism.
- Webhook authentication was implemented rather than assumed.
- The exact raw body was preserved for signature verification.
- Timing-safe comparison was used.
- Redis/BullMQ replaced the in-memory queue.
- Retry behavior was actually tested.
- Duplicate events were tested.
- Wrong-job events were tested.
- Queue failure rollback was implemented.
- Shared configuration was introduced.
- Graceful shutdown was verified.
- Git commits were used as an auditable progression of the work.

### Engineering mindset demonstrated

The project increasingly moved from:

```text
"Does the happy path work?"
```

toward:

```text
"What happens if the dependency fails, the event repeats,
the event is wrong, the job is delayed, or the process stops?"
```

That is the most important backend engineering transition demonstrated by this lab.

---

## 37. Final Reflection

The Meridian Pivot changed the project from a simple integration demo into a practical asynchronous systems exercise.

The biggest lesson was that distributed systems require explicit thinking about time and failure.

The API request happens now.

The queue processes work later.

The worker calls another component later still.

The callback may be duplicated, delayed, rejected, or mismatched.

The backend therefore needs explicit state, correlation, authentication, retries, idempotency, and observability.

The final architecture captures that thinking.

---

## 38. Final Learning Summary

By the end of the project, I learned:

- how polling works and where it becomes inefficient
- why webhooks are useful for event-driven integrations
- how HMAC-SHA256 authenticates webhook payloads
- why raw-body preservation matters
- how timing-safe comparison is used
- why asynchronous APIs should use `202 Accepted`
- why `PENDING` is a business state
- how UUID job IDs correlate asynchronous operations
- how Redis and BullMQ provide a real queue architecture
- how retry and backoff policies work
- why failed jobs should remain observable
- why duplicate delivery must be expected
- how idempotent completion prevents repeated state transitions
- why authentication and correlation solve different problems
- how to handle queue submission failure with rollback
- how to share configuration safely
- how to keep secrets out of Git
- how to diagnose whether Redis, API, or worker availability is the problem
- how graceful shutdown improves operational safety
- how Git history provides evidence of architectural progression
- how to distinguish a strong prototype from a production-ready service

---

## 39. Final Status

The SignalShelf backend is complete for the scope of the Meridian Pivot learning exercise.

Final architecture:

```text
Client
  ↓
Express API
  ↓
BullMQ
  ↓
Redis
  ↓
BullMQ Worker
  ↓
HMAC-signed Webhook
  ↓
Signature + Correlation Verification
  ↓
CHECKED_IN
```

Final Git state:

```text
646df52 (HEAD -> main, origin/main) feat: finalize SignalShelf backend
```

Final working tree:

```text
nothing to commit, working tree clean
```

The backend is therefore ready to be presented as the completed Meridian Pivot implementation, with its remaining prototype limitations clearly documented.

---

# End of Learning Journal
