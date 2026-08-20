# SignalShelf Event Lab — Learning Journal

## Assignment

The Meridian Pivot — Assignment 1

## Technical Concept Learned

Node.js and Express backend development, specifically webhook-style HTTP communication.

## Why This Was Unfamiliar

Before this assignment, I was more familiar with frontend development than building an HTTP backend that receives and processes events.

## What I Learned

### Node.js

[Explain in your own words.]

### Express

[Explain in your own words.]

### GET vs POST

GET is used to request/retrieve information.

POST is used to send information to a server for processing.

### JSON

I learned that `express.json()` allows Express to parse incoming JSON request bodies so they can be accessed through `req.body`.

### Webhooks

A webhook-style endpoint allows another system to send an HTTP request containing event data to my application.

### Route Parameters

I learned that `/resources/:id` creates a dynamic route and that `req.params.id` retrieves the value supplied in the URL.

### In-Memory Storage

I used a JavaScript object to temporarily store resource statuses.

The data disappears when the Node.js process stops.

### Validation

I learned that external input should not automatically be trusted. I validated the event, resource ID, and allowed resource statuses before storing data.

## Endpoints

- `GET /`
- `POST /webhooks/resource-update`
- `GET /resources/:id`

## Debugging Evidence

### ERR_HTTP_HEADERS_SENT

I accidentally sent more than one response for the same request. I learned that a request should normally receive one response.

### Validation Error

Initially I checked the entire `req.body` instead of the `status` property. I corrected this by accessing `req.body.status`.

### Missing Resources

I added a 404 response when a requested resource does not exist.

## Responsible Engineering

I learned that data received from external systems should be validated before it is processed or stored.

## Final Outcome

I successfully built a small working SignalShelf resource availability prototype that receives resource updates through a webhook-style POST endpoint, validates them, stores them temporarily in memory, and retrieves resource status through a GET endpoint.

## What I Would Improve Next

For a production system, I would consider persistent storage, stronger validation, authentication for webhook requests, structured error responses, logging, and protection against duplicate or replayed events.

### HMAC Webhook Verification

I learned that HMAC can be used to verify that a webhook request was generated using a shared secret. Node.js provides HMAC functionality through its built-in `node:crypto` module, so I did not need to install another package.

I used `createHmac('sha256', secret)` to create an HMAC calculation, `update(message)` to provide the data being authenticated, and `digest('hex')` to produce the final hexadecimal signature.

### HMAC Experiment

I created a separate `hmac-lab.js` experiment before modifying my Express application.

With the same secret and this message:

`resource.updated:room-101:available`

I received this signature:

`80ac0901f4f0d60858b902cc7c3a4dab722892708a3e0c79b4c6ac769907a4a2`

I then changed the resource status from `available` to `occupied`. The signature changed to:

`fb530ccfe2dce3bee6a7f7bb626ec184079a60b054797e6d0285f8a1ebcea304`

This showed me that changing the authenticated message changes the resulting signature.

I then changed the secret while keeping the message as `resource.updated:room-101:occupied`. The signature changed to:

`63cee7b2dca28934737eb69a38feb5007c0f9f3a65667a32b4f4755e48e2fef6`

This demonstrated that the secret is also part of the HMAC calculation.

### Independent Learning Evidence

I initially understood the secret as something that protects the application, but I did not understand how `crypto.createHmac()` worked. I investigated the Node.js crypto functionality and tested it independently in a small experiment before integrating it into my Express application.

The experiment helped me understand that the sender and receiver can independently calculate a signature using the same message and shared secret, then compare the results.


## HMAC Verification Tests
Test 1 — No signature
Expected: 401
Actual: ...
Result: PASS/FAIL

Test 2 — Incorrect signature
Expected: 401
Actual: ...
Result: PASS/FAIL

Test 3 — Correct signature
Expected: 200
Actual: ...
Result: PASS/FAIL

Test 4 — Signature reused with modified payload
Expected: 401
Actual: ...
Result: PASS/FAIL

## What I Learned From Testing

I learned that the webhook signature is tied to both the secret and the exact payload being authenticated. A valid signature for one payload cannot simply be reused after changing the payload. This helped me understand why verifying the signature before processing webhook data is important.

### Duplicate Webhook Route

During HMAC testing, a correctly signed webhook request reached the application and passed signature verification, but the resource could not later be retrieved.

I investigated the issue using:

`grep -n "resources\|resource-update\|app.listen" index.js`

This revealed that I had accidentally created two `POST /webhooks/resource-update` route handlers.

The first route verified the HMAC signature but ended without calling the validation and storage logic. As a result, the request was authenticated but the resource status was never stored.

I fixed this by combining the HMAC verification, payload validation, and resource storage into one route handler.

This taught me that route flow matters: code placed in a separate handler for the same path does not automatically continue after the first handler sends or finishes a response.

## HMAC Verification Test Results

### Test 1 — Missing Signature

I sent a resource update without an `x-webhook-signature` header.

Expected result: The request should be rejected.

Actual result: `Invalid webhook signature`.

Result: PASS.

### Test 2 — Incorrect Signature

I sent a request with an intentionally incorrect signature.

Expected result: The request should be rejected.

Actual result: `Invalid webhook signature`.

Result: PASS.

### Test 3 — Correct Signature

I generated a signature using the same webhook secret and the exact JSON payload sent to the application.

Expected result: `200 OK` and the resource should be stored.

Actual result: `HTTP/1.1 200 OK`.

I then requested `/resources/room-101`, and the stored resource status was successfully available.

Result: PASS.

### Test 4 — Modified Payload With Old Signature

I reused the signature generated for a payload containing the status `available`, but changed the request payload to `occupied`.

Expected result: The request should be rejected because the signature was created for different data.

Actual result: `HTTP/1.1 401 Unauthorized`.

Result: PASS.

### Data Integrity Check

After the modified request was rejected, I requested `/resources/room-101` again.

The resource still returned:

`available`

This showed that the rejected request did not overwrite the existing resource data.

### What I Learned From Testing

I learned that an HMAC signature is connected to both the shared secret and the exact request data. A signature that is valid for one payload cannot be reused after changing that payload.

I also learned that verifying a webhook signature should happen before processing or storing external data.

## Responsible Engineering Reflection

### ETHOS

I considered whether incoming webhook data should be trusted automatically. I decided that external input should be verified and validated before it can change application state.

### HORIZON

I considered future risks beyond the immediate prototype. The current implementation uses an in-memory object, so data disappears when the server stops. A production version would need persistent storage, stronger secret management, replay protection, monitoring, and more robust error handling.

### TRACK

I kept track of the changes and troubleshooting steps during development instead of only documenting the final successful result. This includes the HMAC experiments, failed tests, duplicate-route problem, and the fix.

### OASIS

I considered the operational behavior of the service. Invalid requests receive explicit HTTP errors instead of being silently accepted, making failures easier to identify and investigate.

### PRIDE

I tried to keep the implementation understandable and traceable. The webhook verification, validation, and storage steps are separated logically within the request flow.

### TRAIL

I maintained evidence of what I changed and why through the learning journal, terminal testing, Git changes, and debugging notes.

### CYCLE

I used an iterative process: build, test, observe the result, identify a problem, modify the implementation, and test again.

### RANK

I prioritized security and correctness before adding additional features. HMAC verification and payload validation were completed before moving toward further functionality.

### HUNT

When the expected resource was not being stored, I investigated the actual application rather than assuming the problem was with the testing command. I used source inspection and identified duplicate webhook routes as the root cause.

### GUARD

I protected the webhook secret by storing it in `.env` and adding `.env` to `.gitignore`. I also rejected unsigned, incorrectly signed, and modified webhook requests before they could update stored resource data.

## Day 2 Completion Summary

Today I extended my SignalShelf Event Lab prototype by learning and implementing HMAC-SHA256 webhook verification.

I first experimented with Node.js `crypto` independently using `hmac-lab.js`. I learned that the same secret and message produce a deterministic HMAC signature, while changing the message produces a different signature.

I then integrated the concept into my Express application. The application now captures the raw webhook request body, generates an expected HMAC using the secret stored in an environment variable, and compares it with the signature supplied by the sender.

During testing I encountered a real blocker: I had accidentally created two handlers for the same webhook route. The first handler verified the signature but did not continue to the storage logic. I investigated this using `grep`, inspected the route definitions, identified the duplicate handlers, and combined the verification, validation, and storage logic into one route.

I retested the application after the fix.

The final tests showed:
- Correctly signed webhook: 200 OK
- Resource retrieval after valid webhook: available
- Modified payload using an old signature: 401 Unauthorized
- Resource remained available after the rejected request

This prototype demonstrates that I can independently learn an unfamiliar backend/security concept, troubleshoot a real implementation problem, and document the reasoning and evidence behind the final solution.

### Day 2 Limitations

This is still a learning prototype rather than a production service. It uses in-memory storage, a single shared webhook secret, no persistent database, no replay protection, and no rate limiting. These limitations are intentionally documented rather than hidden.

### Next Step

The next phase will move from the independent prototype toward the Meridian Pivot system specification while preserving the lessons learned from webhook verification, validation, security, and debugging.

## Day 3 — Polling Architecture and Baseline

### Step 1: Mock Warehouse API

I created a local mock warehouse service to simulate an external system that SignalShelf would query.

The mock service runs on port 4000 and exposes:

GET /warehouse/resources

It returns three simulated resources:
- room-101: available
- room-102: occupied
- room-103: maintenance

This allowed me to test the polling architecture without depending on a third-party service.

### Step 2: Learning HTTP Fetching

I learned how a Node.js application can communicate with another HTTP service using the built-in `fetch` function.

I created `polling-lab.js` to request data from the mock warehouse API running on port 4000.

The request was:

GET http://localhost:4000/warehouse/resources

The warehouse returned JSON containing the current resource statuses.

I used `async` and `await` because the HTTP request is asynchronous and the application must wait for the response before processing it.

### Step 3: Polling and Cache Refresh

I extended the prototype so that it could repeatedly request the warehouse API and update the SignalShelf cache.

I initially tested a shorter interval of 10 seconds during development so I could observe repeated polling without waiting several minutes. After confirming the behavior, I configured the production interval to 300000 milliseconds, which is five minutes.

I also added response checking and error handling so a failed warehouse request is logged instead of being treated as valid inventory data.

### Architecture and Integration

The Day 3 architecture is:

Mock Warehouse API
→ HTTP polling every five minutes
→ SignalShelf cache
→ GET /resources/:id

I separated the polling logic into `poller.js` so that warehouse communication was handled independently from Express route logic. I then imported the poller into `index.js` and started polling when the server started.

The first request happens immediately to populate the cache, and subsequent requests continue on the configured interval.

### Verification and Tests

The SignalShelf API successfully returned:

- room-101: available
- room-102: occupied
- room-103: maintenance

I also tested a nonexistent resource and confirmed that the API returned HTTP 404.

I then simulated a resource change in the mock warehouse. After changing `room-101` from `available` to `occupied`, the warehouse API reflected the new value immediately, while SignalShelf updated the cache only after the next polling cycle.

This demonstrated the core polling trade-off: synchronization is delayed by the polling interval, but the system remains simple and reliable.

### Failure Handling

I tested the polling service while the mock warehouse API was unavailable. The request failed, the error was caught, and the SignalShelf process remained running instead of crashing.

I observed repeated failed polling attempts while the warehouse was down, but the main server continued to operate. This verified that the polling service handles external failures gracefully.

### Day 3 Lessons Learned

The polling approach is straightforward and easy to reason about, but it introduces data staleness and extra requests when data has not changed. A shorter polling interval reduces stale data but increases traffic; a longer interval reduces traffic but increases the chance of outdated information.

This trade-off became an important architectural consideration before the next phase of the project.

## Day 4 — Change Detection

### Technical Concept Learned

I learned how to detect changes between a previously cached value and a newly fetched value.

The Day 3 poller copied warehouse data into the SignalShelf cache every time it polled. In Day 4, I changed the poller so it compares the previous cached status with the newly fetched warehouse status before updating the cache.

The comparison follows this idea:

old status → new status

If the values are different, a change is detected.

If the values are the same, no change is reported.

### Initial State Behavior

When SignalShelf starts for the first time, it does not have a previous value for a resource.

For example:

undefined → maintenance

This is treated as the initial state rather than a detected change because there is no previous cached value to compare against.

### Change Detection Experiment

I first allowed SignalShelf to poll the warehouse and establish:

room-101 = maintenance

I then changed the warehouse value to:

room-101 = available

During the next polling cycle, SignalShelf detected:

maintenance → available

The application logged:

`Change detected: room-101: maintenance → available`

The SignalShelf cache was then updated to:

`room-101: available`

### Repeated Polling Test

After the change was detected, subsequent polling cycles continued to retrieve the warehouse data.

Because room-101 remained `available`, the application did not repeatedly report the same change.

This demonstrated that the comparison is based on the previous state and the newly fetched state.

### What I Learned

I learned that polling does not have to blindly process every retrieved value. A polling system can compare the previous state with the current state and react only when a meaningful change occurs.

This reduces unnecessary event processing and provides a bridge between polling-based synchronization and event-driven behavior.

## Day 4 — Responsible Engineering Reflection

### ETHOS

I considered whether every polling result should automatically trigger processing. I chose to distinguish between unchanged data and actual state transitions so the system does not unnecessarily process identical information.

### HORIZON

I considered how this approach could behave as the system grows. A production system would need more robust change tracking, persistent state, monitoring, and possibly a dedicated event or message system.

### TRACK

I recorded the actual transition tested during development:

`maintenance → available`

I also documented the initial-state behavior and the repeated polling behavior.

### OASIS

The polling process provides observable logs showing successful synchronization and detected changes. This makes the system easier to monitor and troubleshoot.

### PRIDE

The change-detection logic is kept close to the synchronization process, making it easier to understand why a resource was updated.

### TRAIL

The Day 4 experiment is supported by terminal output, source-code changes, and this learning journal.

### CYCLE

I followed an iterative process: modify the poller, check syntax, run the system, change warehouse data, observe the polling result, and verify that the cache changed correctly.

### RANK

I prioritized correctness of state synchronization before adding more advanced event-processing features.

### HUNT

When the first experiment did not produce a change event, I investigated why. SignalShelf had started after the warehouse had already changed, so the warehouse value became the initial cached state. I then performed a second transition and successfully detected the change.

### GUARD

The system only reports a change when a previous cached value exists and the newly retrieved value differs from it. This helps prevent the initial state from being incorrectly treated as a state transition.


# Meridian Pivot — Asynchronous Badge Printing

## Pivot Summary

The original SignalShelf check-in flow depended on a synchronous printer API. The kiosk would send a print request and wait for the printer response before completing the check-in.

The Meridian Pivot changed this requirement. The printer vendor deprecated the synchronous API, so the system was redesigned around asynchronous communication:

```text
Kiosk
  ↓
POST /check-in/:attendeeId
  ↓
SignalShelf creates job
  ↓
POST /print-queue
  ↓
Vendor queue
  ↓
Printer processes job
  ↓
POST /webhooks/print-complete
  ↓
HMAC verification
  ↓
Attendee becomes CHECKED_IN
```

## What Was Implemented

### 1. Asynchronous print queue

The SignalShelf service no longer waits for printer completion.

A check-in request creates a unique `jobId`, changes the attendee state to `PENDING`, and publishes the print request to the vendor queue.

The check-in endpoint returns HTTP `202 Accepted`.

### 2. Vendor-side processing

The mock badge-printer vendor consumes jobs from the queue and simulates printing.

The vendor waits before sending a completion callback, representing asynchronous real-world processing.

### 3. Print completion webhook

SignalShelf exposes:

```text
POST /webhooks/print-complete
```

The vendor sends the job ID, attendee ID, and completion status to this endpoint.

### 4. Webhook authentication

Print-completion callbacks are protected with an HMAC-SHA256 signature using `WEBHOOK_SECRET`.

Invalid or missing signatures are rejected with:

```text
401 Unauthorized
```

The raw request body is captured before JSON parsing so the signature can be verified against the exact payload received.

### 5. Duplicate-scan protection

An attendee cannot receive another badge when their status is already `PENDING` or `CHECKED_IN`.

A duplicate check-in request returns:

```text
409 Conflict
```

This protection remains active even though printing is asynchronous.

### 6. Job correlation

The webhook must contain the same `jobId` stored against the attendee.

A mismatched job is rejected with:

```text
409 Conflict
```

This prevents a completion event for one print job from incorrectly checking in another attendee.

### 7. Retry and failure handling

Webhook delivery uses up to three delivery attempts.

A failed job can also be returned to the vendor queue for another processing attempt.

The demonstrated failure path produced:

```text
Webhook attempt 1/3: 401
Webhook attempt 2/3: 401
Webhook attempt 3/3: 401
Retrying job ... Attempt 2/3
Retrying job ... Attempt 3/3
Job ... permanently failed after 3 attempts
```

This demonstrates that the system does not silently lose failed print jobs.

## Validation Evidence

The following attendee scenarios have been tested:

* ATT-001 — successful asynchronous check-in
* ATT-002 — successful asynchronous check-in
* ATT-003 — successful asynchronous check-in
* Duplicate check-in — rejected with `409 Conflict`
* Unknown attendee — rejected with `404 Not Found`
* Invalid webhook signature — rejected with `401 Unauthorized`
* Incorrect job ID — rejected with `409 Conflict`
* Invalid print completion payload — rejected with `400 Bad Request`
* Failed webhook delivery — retried and eventually permanently failed

## Current Architecture

```text
                ┌─────────────────────┐
                │   SignalShelf Kiosk │
                └──────────┬──────────┘
                           │
                           │ POST /check-in
                           ▼
                ┌─────────────────────┐
                │   SignalShelf API   │
                │                     │
                │ PENDING + jobId     │
                └──────────┬──────────┘
                           │
                           │ REST publish
                           ▼
                ┌─────────────────────┐
                │   Vendor Queue      │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ Mock Badge Printer  │
                └──────────┬──────────┘
                           │
                           │ signed webhook
                           ▼
                ┌─────────────────────┐
                │ /webhooks/          │
                │ print-complete      │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ HMAC verification   │
                │ + job correlation   │
                └──────────┬──────────┘
                           │
                           ▼
                    CHECKED_IN
```

## Learning From the Pivot

The main architectural lesson is that asynchronous integrations change the meaning of application state.

`PENDING` is now a real business state rather than an intermediate implementation detail.

The system must therefore:

1. Create a durable correlation identifier (`jobId`).
2. Track the state of the check-in.
3. Accept completion events later.
4. Authenticate external callbacks.
5. Correlate callbacks with the original request.
6. Protect against duplicate scans.
7. Retry failed delivery.
8. Stop retrying after a defined limit.
9. Make failure visible rather than silently marking the attendee as checked in.

## Queue Architecture Update

The original implementation used an in-memory JavaScript queue and mock printer vendor.

That architecture was replaced with Redis + BullMQ.

Redis now provides the external queue backing, while BullMQ manages job creation, worker processing, retries, backoff, completion, and failure states.

The existing API and webhook contract were preserved during the migration.

The current architecture is therefore:

```text
Check-in API
    ↓
BullMQ
    ↓
Redis
    ↓
BullMQ Worker
    ↓
HMAC-signed webhook
    ↓
Print completion endpoint
    ↓
CHECKED_IN

## Pivot Status

The core Meridian Pivot requirements are implemented and demonstrated.

The next phase is to harden the queue architecture, improve observability, and prepare the implementation for a final end-to-end demonstration.

## Day 5 — Redis + BullMQ Async Queue

### Pivot implementation

The SignalShelf check-in backend was migrated from the earlier in-memory/vendor simulation to a Redis-backed asynchronous queue using BullMQ.

New architecture:

```text
Check-in API
    ↓
BullMQ Queue
    ↓
Redis
    ↓
BullMQ Worker
    ↓
HMAC-signed webhook
    ↓
Print completion endpoint
    ↓
Attendee CHECKED_IN


## Day 6 — Reliability, Retry, and Final End-to-End Verification

### Reliability improvements

Day 6 focused on proving that the Redis + BullMQ architecture behaves reliably under normal, duplicate, invalid, and failed conditions.

The implementation now provides:

- Redis-backed durable queue infrastructure.
- BullMQ job processing.
- Three configured job attempts.
- Fixed 1-second retry backoff.
- HMAC authentication for webhook callbacks.
- Job ID correlation between check-in requests and completion events.
- Duplicate check-in protection.
- Protection against completion events with the wrong job ID.
- Idempotent handling of repeated completion callbacks.

### Retry test

A controlled BullMQ failure test was performed using a temporary worker.

The worker intentionally threw an error and BullMQ retried the job three times:

```text
Processing attempt 1
Job failed. Attempts made: 1

Processing attempt 2
Job failed. Attempts made: 2

Processing attempt 3
Job failed. Attempts made: 3