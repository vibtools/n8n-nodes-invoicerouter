
# API

**Project:** InvoiceRouter
**Status:** MVP
**Version:** v1.0.0

---

# Purpose

This document defines the unified API architecture used by InvoiceRouter.

Every supported payment provider must implement the same request lifecycle while exposing a consistent interface to the n8n workflow.

The goal is to hide provider-specific implementation details behind a normalized API layer.

---

# API Philosophy

InvoiceRouter follows a **Provider Pattern**.

The n8n node never communicates directly with Stripe, Paddle, Polar, or any other provider.

Instead, every request passes through a standardized execution pipeline.

---

# API Flow

```text
n8n Workflow
      │
      ▼
Provider Loader
      │
      ▼
Provider Selector
      │
      ▼
Provider Validator
      │
      ▼
Payload Builder
      │
      ▼
HTTP Request
      │
      ▼
Provider REST API
      │
      ▼
Response Parser
      │
      ▼
Normalized Output
```

---

# Request Lifecycle

Every request follows the same lifecycle.

```text
Receive Input

↓

Validate Provider

↓

Build Provider Payload

↓

Execute HTTP Request

↓

Receive Provider Response

↓

Parse Response

↓

Normalize Response

↓

Return Output
```

---

# Normalized Input

Every provider receives the same normalized input model.

Example:

```json
{
  "provider": "stripe",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "currency": "USD",
  "items": [
    {
      "name": "Hosting",
      "price": 10
    }
  ]
}
```

The normalized model is converted into a provider-specific payload before sending the request.

---

# Provider Responsibilities

Every provider is responsible for:

* Validating input
* Building request payloads
* Executing API requests
* Parsing provider responses
* Returning normalized output

---

# Provider API Pipeline

```text
Normalized Input
        │
        ▼
ProviderValidator
        │
        ▼
ProviderPayload
        │
        ▼
HTTP Client
        │
        ▼
Provider API
        │
        ▼
ProviderParser
        │
        ▼
Normalized Output
```

---

# HTTP Layer

The HTTP layer is responsible for:

* Request execution
* Authentication
* Headers
* Query parameters
* Request body
* Response handling
* Error handling

Business logic should not exist inside the HTTP layer.

---

# Authentication

Authentication is provider-specific.

Examples include:

* API Key
* Bearer Token
* Basic Authentication
* OAuth

Authentication implementation remains isolated inside each provider.

---

# Request Validation

Before sending a request, every provider should verify:

* Required fields
* API credentials
* Payload validity
* Provider configuration

Invalid requests must not be submitted.

---

# Response Normalization

Regardless of the provider, InvoiceRouter returns a consistent response model.

Example:

```json
{
  "provider": "stripe",
  "invoiceId": "inv_123",
  "status": "paid",
  "currency": "USD",
  "invoiceUrl": "https://example.com/invoice"
}
```

The response format should remain consistent across all providers.

---

# Error Handling

Provider-specific errors should be converted into a standardized error format before being returned to the workflow.

Error responses should include:

* Provider
* Error code
* Message
* Details (when available)

---

# Supported Providers (MVP)

Version **1.0.0** supports:

* Stripe
* LemonSqueezy
* Paddle
* Polar

Every provider must implement the same API lifecycle.

---

# Future Expansion

Future versions may include support for:

* Additional invoice operations
* Refund APIs
* Subscription APIs
* Customer APIs
* Webhook APIs

These additions must follow the existing API architecture.

---

# Freeze Rules

The API architecture is governed by the project's Freeze documents.

The request lifecycle, normalization model, and provider isolation principles must remain consistent throughout the MVP lifecycle.

---

**Version:** v1.0.0
**Status:** Official API Architecture Documentation
