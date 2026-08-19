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