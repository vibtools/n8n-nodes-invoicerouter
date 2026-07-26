````md
# InvoiceRouter Providers

Version: 0.1.0

Status: Planning

---

# Purpose

This document defines how every invoice provider should be integrated into InvoiceRouter.

Every provider must follow the same architecture, interface, request flow, and response format.

The goal is simple:

> **Any invoice provider should work without changing the workflow.**

---

# Provider Philosophy

InvoiceRouter never communicates directly with provider-specific APIs inside the workflow.

Instead,

```
Workflow

↓

InvoiceRouter

↓

Provider Adapter

↓

Provider API
```

This keeps every workflow provider-independent.

---

# Provider Categories

## REST API

Examples

- Stripe
- Invoice Ninja
- ERPNext
- Odoo

---

## OAuth2

Examples

- Zoho Invoice
- Xero
- QuickBooks

---

## Custom API

Any provider with a REST API.

---

## Future

- SOAP
- GraphQL
- XML APIs

---

# Supported Providers (MVP)

| Provider | Status |
|----------|--------|
| Stripe | Planned |
| Zoho Invoice | Planned |
| Invoice Ninja | Planned |
| ERPNext | Planned |
| Custom REST API | Planned |

---

# Future Providers

| Provider | Status |
|----------|--------|
| Xero | Future |
| QuickBooks | Future |
| Odoo | Future |
| FreshBooks | Future |
| Paddle | Future |
| Square | Future |
| Wave | Future |
| Chargebee | Future |

---

# Provider Folder Structure

```
providers/

├── stripe/
│   ├── adapter.ts
│   ├── payload.ts
│   ├── parser.ts
│   └── validator.ts
│
├── zoho/
│   ├── adapter.ts
│   ├── payload.ts
│   ├── parser.ts
│   └── validator.ts
│
├── invoice_ninja/
│   ├── adapter.ts
│   ├── payload.ts
│   ├── parser.ts
│   └── validator.ts
│
└── custom/
```

---

# Provider Lifecycle

Every provider follows exactly the same lifecycle.

```
Load Provider

↓

Validate Configuration

↓

Build Payload

↓

HTTP Request

↓

Receive Response

↓

Parse Response

↓

Return Standard Response
```

---

# Provider Interface

Every provider must implement the following methods.

```
validate()

buildPayload()

send()

parseResponse()

normalizeError()
```

Future

```
downloadPdf()

getInvoice()

cancelInvoice()

markPaid()
```

---

# Provider Configuration

Current Source

```
Google Sheets
```

Future

```
SQLite
```

Later

```
Provider Manager Panel
```

---

# Google Sheet

Sheet Name

```
Providers
```

---

# Required Columns

| Column | Required |
|---------|----------|
| enabled | Yes |
| provider_name | Yes |
| provider_type | Yes |
| api_url | Yes |
| api_key | Yes |

---

# Optional Columns

| Column |
|---------|
| secret |
| username |
| password |
| oauth_token |
| refresh_token |
| organization_id |
| account_id |
| priority |
| weight |
| rate_limit |
| daily_limit |
| timeout |
| notes |

---

# Example Provider

| enabled | provider_name | provider_type | api_url | api_key |
|----------|---------------|---------------|----------|----------|
| TRUE | Stripe-US | stripe | https://api.stripe.com | sk_xxx |

---

# Provider Pool

Provider Loader converts the sheet into memory.

Example

```json
{
    "Stripe-US": {
        "provider": "stripe",
        "enabled": true
    },

    "ERPNext": {
        "provider": "erpnext",
        "enabled": true
    }
}
```

Only enabled providers are loaded.

---

# Routing

Provider Selector receives the Provider Pool.

Possible algorithms

- Round Robin
- Random
- Priority
- Weight Based
- Least Used
- Manual

Future

- Health Based
- Cost Based
- Fastest Provider

---

# Universal Request

All providers receive exactly the same object.

Example

```json
{
    "customer": {},
    "invoice": {},
    "items": []
}
```

Every provider converts this object internally.

---

# Standard Response

Every provider returns the same response.

```json
{
    "success": true,
    "provider": "",
    "invoice_id": "",
    "invoice_number": "",
    "invoice_url": "",
    "pdf_url": "",
    "status": "",
    "message": ""
}
```

The workflow never needs to know which provider generated the response.

---

# Error Format

Every provider must normalize errors.

Example

```json
{
    "success": false,
    "code": "AUTH_ERROR",
    "message": "Authentication failed."
}
```

Provider-specific error messages should never be exposed directly to workflow logic.

---

# Retry Strategy

Supported

- Network Error
- Timeout
- HTTP 429
- Temporary Server Error

Future

- Exponential Backoff
- Smart Retry
- Provider Failover

---

# Provider Validation

Before any request:

- Validate required fields.
- Validate provider type.
- Validate API URL.
- Validate credentials.
- Validate request object.

If validation fails:

```
Stop Request

↓

Return Error
```

---

# Adapter Rules

Every provider adapter must:

- Be completely isolated.
- Never access another provider.
- Never contain shared HTTP logic.
- Never duplicate shared utilities.
- Use the shared HTTP client.
- Return the standard response format.

---

# Development Checklist

Before adding a new provider:

- Create provider folder.
- Implement interface.
- Build payload mapper.
- Build response parser.
- Build validator.
- Test with mock responses.
- Test with real API.
- Verify standard response.
- Verify error normalization.

---

# Future Vision

InvoiceRouter should allow users to switch providers by changing configuration only.

No workflow changes.

No node changes.

No downstream modifications.

Only the provider configuration changes.
````
