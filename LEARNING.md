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

## Day 3 — Original Architecture

### Step 1: Mock Warehouse API

I created a local mock warehouse service to simulate an external system that SignalShelf will query.

The mock service runs on port 4000 and exposes:

GET /warehouse/resources

It currently returns three simulated resources:
- room-101: available
- room-102: occupied
- room-103: maintenance

### Why I Created It

A real warehouse API is not available for this learning prototype, so I created a local service that behaves like an external warehouse API.

This allows me to test the polling architecture without depending on a third-party service.

### Architecture Decision

SignalShelf runs on port 3000 while the mock warehouse runs on port 4000. Keeping them as separate services simulates the relationship between an application and an external inventory system.

### Responsible Engineering

I am clearly treating the warehouse as simulated data rather than representing it as a real production data source. The prototype also avoids storing sensitive personal information.

### Step 2: Learning HTTP Fetching

I learned how a Node.js application can communicate with another HTTP service using the built-in fetch function.

I created polling-lab.js to request data from the mock warehouse API running on port 4000.

The request was:

GET http://localhost:4000/warehouse/resources

The warehouse returned JSON data containing the current resource statuses.

I used async and await because the HTTP request is asynchronous and the application must wait for the warehouse response before processing the returned data.

### Evidence

The polling test successfully received:
- room-101: available
- room-102: occupied
- room-103: maintenance

### Learning

I learned that an HTTP client can retrieve JSON from another service and convert that response into a JavaScript object that can be processed by the application.

### Troubleshooting Note

I initially treated the warehouse and SignalShelf as if they were the same application. I clarified the architecture by running the mock warehouse separately on port 4000 and using a separate Node.js script to request its data.

This helped me understand that a service can act as an HTTP client while another service acts as an HTTP server.

### Step 3: Polling and Cache Refresh

I extended the polling prototype so that it can repeatedly request the warehouse API and update the SignalShelf cache.

I first tested the polling interval using 10 seconds instead of 5 minutes. This allowed me to verify the repeated behavior without waiting several minutes between tests.

After confirming the behavior, I configured the interval to 300000 milliseconds, which represents five minutes.

I also added response checking and error handling. The application checks whether the warehouse response was successful before processing it and catches polling errors so that a failed warehouse request can be logged instead of silently breaking the application.

### Engineering Reasoning

The shorter development interval was used only for testing. The final configured interval follows the original Day 3 specification of five-minute polling.

### Reliability Consideration

The polling service depends on the warehouse being reachable. Error handling prevents an individual failed request from being treated as valid inventory data.

## Day 3 — Original Specification

### Warehouse Integration

I created a mock warehouse API running on port 4000. It exposes resource availability data through an HTTP GET endpoint.

### Polling Prototype

I created `polling-lab.js` to learn how SignalShelf could request warehouse data and update its local cache.

I initially tested the polling interval at 10 seconds so I could observe repeated polling during development. After confirming that the mechanism worked, I configured the production prototype for the required five-minute interval.

### Poller Module

I separated the warehouse polling logic into `poller.js` rather than putting all functionality inside `index.js`.

This helped separate the responsibility of communicating with the warehouse from the responsibility of handling Express routes.

### SignalShelf Integration

I imported the polling module into `index.js` and started the polling process when the Express server starts.

The first warehouse request happens immediately so that the cache is populated when the application starts. Subsequent requests occur every five minutes.

### Verification

The SignalShelf API successfully returned:

- room-101: available
- room-102: occupied
- room-103: maintenance

I also tested a nonexistent resource and confirmed that the API returned HTTP 404.

### Architecture

Mock Warehouse API
→ Poller
→ SignalShelf cache
→ Resource query endpoint

### Engineering Decision

I kept the polling functionality separated into its own module so that the system would be easier to change if the external integration method changed later.

### Synchronization Test

I added a development-only update endpoint to the mock warehouse so that I could simulate a resource status changing.

Initially:

- Warehouse room-101 = available
- SignalShelf room-101 = available

I then changed the warehouse state:

- Warehouse room-101 = occupied

The SignalShelf cache did not necessarily change immediately because the system uses polling rather than real-time updates.

After the next polling cycle, the SignalShelf cache reflected the new warehouse state:

- Warehouse room-101 = occupied
- SignalShelf room-101 = occupied

### Polling Trade-off

This test demonstrated that polling introduces synchronization delay. A five-minute polling interval means that changes in the warehouse may not be visible to SignalShelf immediately.

This limitation is important because it establishes a baseline for the architecture before the Day 4 pivot.

### Synchronization Test

I simulated a warehouse resource change using the mock warehouse API.

Initial state:

- room-101 = available

I changed the warehouse state using the development update endpoint:

- room-101 = occupied

The warehouse API subsequently returned room-101 as occupied.

SignalShelf then performed a polling cycle and updated its local cache:

- room-101 = occupied
- room-102 = occupied
- room-103 = maintenance

This confirmed that the polling architecture can synchronize SignalShelf's cached state with the warehouse.

### Important Observation

The system does not receive warehouse changes immediately. It discovers changes during polling cycles. This creates a synchronization delay and means the cached information can temporarily differ from the warehouse's current state.

This limitation is an important architectural trade-off that will be relevant when evaluating the system's response to a future change in the integration method.

### Failure Handling Test

I tested the polling service with the mock warehouse unavailable.

The warehouse service was stopped while SignalShelf was running. The polling request failed, but the error was caught and reported by the polling service.

The SignalShelf process remained running instead of crashing.

I temporarily reduced the polling interval during development so that I could observe the failure behavior without waiting five minutes. I restored the configured interval to five minutes after testing.

### Result

The failure-handling behavior worked as intended.

This demonstrated that the polling service can detect and report an unavailable warehouse without terminating the main application.

### Polling Failure Test

I tested the polling service while the mock warehouse API was unavailable.

The SignalShelf server started successfully, but the polling requests failed with:

`Polling failed: fetch failed`

The error was caught by the polling service instead of terminating the application.

I observed multiple failed polling attempts while the warehouse remained unavailable.

### Result

The failure-handling test passed. The main SignalShelf process remained running while the polling failure was reported.

For testing purposes, I temporarily used a shorter polling interval so that I could observe repeated failures without waiting five minutes. I restored the final configuration to the required five-minute polling interval after the test.

### Day 3 Architectural Baseline

The completed Day 3 architecture is:

Mock Warehouse API
→ HTTP polling every five minutes
→ SignalShelf cache
→ Resource query endpoint

The architecture provides periodic synchronization but introduces synchronization delay because changes are only discovered during polling cycles.

## Day 3 — Original Specification

### Original Requirement

The system must poll a warehouse API every five minutes, cache the returned resource availability data, and expose an endpoint that allows clients to query the cached status.

### Architecture

The Day 3 architecture consists of:

1. A mock warehouse API running on port 4000.
2. A polling module that requests warehouse data.
3. An in-memory SignalShelf cache.
4. A resource query endpoint on the SignalShelf Express server.

The data flow is:

Mock Warehouse API
→ HTTP polling
→ SignalShelf cache
→ GET /resources/:id

### Polling Implementation

The polling interval is configured as 300000 milliseconds, which is five minutes.

The poller performs an immediate initial request when the application starts and then continues polling at the required interval.

### Error Handling

The poller checks the HTTP response and throws an error when the warehouse request fails.

The error is caught and logged without terminating the SignalShelf server.

### Synchronization Test

I changed the warehouse status of `room-101` from `available` to `occupied`.

The warehouse API reflected the change immediately, while SignalShelf only reflected the change after the next polling cycle.

This demonstrated an important architectural characteristic of polling: synchronization is delayed by the polling interval.

### Day 3 Trade-off

The polling approach is relatively simple to understand and implement, but it can introduce synchronization delay and unnecessary requests when no warehouse data has changed.

This trade-off is important because the architecture may need to change if the client requires faster event propagation.

### Polling Synchronization Observation

I changed `room-101` in the mock warehouse from `occupied` to `available`.

The warehouse API reflected the change immediately. SignalShelf did not necessarily reflect the change immediately because it relies on its scheduled polling cycle.

This demonstrated that the polling architecture can produce a temporary difference between the source system and the SignalShelf cache.

The trade-off is:

- shorter polling intervals reduce stale-data time but increase requests;
- longer polling intervals reduce requests but increase stale-data time.

This observation became an important architectural consideration for the later system change.

## Day 3 — Polling Synchronization Observation

I tested what happens when the warehouse resource changes between polling cycles.

Before the change, `room-101` was `occupied` in SignalShelf.

I then changed the warehouse value to `available` using the mock warehouse API.

The warehouse immediately returned:

`available`

However, SignalShelf still returned:

`occupied`

This demonstrated that the cached value can temporarily become stale when using polling.

The difference exists because SignalShelf only learns about warehouse changes during its polling cycle.

### Architectural Trade-off

Polling provides a relatively simple synchronization mechanism, but it introduces synchronization latency.

A shorter polling interval can reduce the time that cached information remains stale, but it causes more requests to the warehouse.

A longer polling interval reduces requests but increases the possible period of stale data.

This became an important architectural limitation of the Day 3 implementation.

### Day 2 Regression Test

After integrating the Day 3 polling architecture, I retested the HMAC-protected webhook endpoint from Day 2.

I generated a signature for the exact JSON payload and sent it with the request.

Expected result: `200 OK`.

Actual result: `HTTP/1.1 200 OK` with `Webhook received`.

Result: PASS.

This confirmed that adding the warehouse polling functionality did not break the existing HMAC verification, validation, or resource update functionality.

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