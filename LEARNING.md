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