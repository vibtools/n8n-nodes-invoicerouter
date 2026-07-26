# Provider Architecture Freeze

**Project:** InvoiceRouter
**Status:** Frozen (MVP)
**Version:** v1.0.0

---

# Purpose

This document defines the official provider architecture for the InvoiceRouter MVP.

Every payment provider must implement the same directory structure, naming convention, and responsibility model.

The provider architecture is designed to ensure consistency, maintainability, and scalability across all supported providers.

---

# Design Principles

Every provider must:

* Follow the same folder structure
* Follow the same file naming convention
* Have a single responsibility for each file
* Remain isolated from other providers
* Be independently maintainable
* Support the common InvoiceRouter workflow

---

# Provider Directory

Each provider must be placed inside the **providers** directory.

Example:

```text id="qxyqpm"
providers/

stripe/
lemonsqueezy/
paddle/
polar/
```

---

# Standard Provider Structure

Every provider must follow the same file layout.

```text id="5tsr58"
Provider/

index.ts

ProviderProvider.ts

ProviderPayload.ts

ProviderParser.ts

ProviderValidator.ts

ProviderTypes.ts

ProviderConstants.ts

ProviderHelpers.ts

README.md
```

Example:

```text id="j4x0vn"
providers/

stripe/

index.ts

StripeProvider.ts

StripePayload.ts

StripeParser.ts

StripeValidator.ts

StripeTypes.ts

StripeConstants.ts

StripeHelpers.ts

README.md
```

---

# File Responsibilities

## index.ts

Purpose

* Export the provider
* Provide a single entry point

---

## Provider.ts

Purpose

* Main provider implementation
* Execute provider operations
* Coordinate internal provider components

---

## ProviderPayload.ts

Purpose

* Build provider-specific request payloads
* Convert normalized invoice data into provider format

---

## ProviderParser.ts

Purpose

* Parse provider responses
* Normalize provider output

---

## ProviderValidator.ts

Purpose

* Validate provider input
* Validate required fields
* Validate provider configuration

---

## ProviderTypes.ts

Purpose

* Provider-specific interfaces
* Provider-specific types
* Internal type definitions

---

## ProviderConstants.ts

Purpose

* API endpoints
* Default values
* Constant definitions

---

## ProviderHelpers.ts

Purpose

* Utility functions
* Shared provider helpers
* Common provider logic

---

## README.md

Purpose

* Provider documentation
* Usage examples
* Provider-specific notes

---

# Provider Lifecycle

Every provider follows the same lifecycle.

```text id="8znix4"
Receive Input
      │
      ▼
Validate Input
      │
      ▼
Build Payload
      │
      ▼
Execute Request
      │
      ▼
Parse Response
      │
      ▼
Return Normalized Output
```

---

# Provider Responsibilities

| File                 | Responsibility                   |
| -------------------- | -------------------------------- |
| index.ts             | Export provider                  |
| Provider.ts          | Main provider implementation     |
| ProviderPayload.ts   | Build request payload            |
| ProviderParser.ts    | Parse provider response          |
| ProviderValidator.ts | Validate input and configuration |
| ProviderTypes.ts     | Provider types and interfaces    |
| ProviderConstants.ts | Constants and endpoints          |
| ProviderHelpers.ts   | Helper utilities                 |
| README.md            | Provider documentation           |

---

# Provider Rules

Every provider must:

* Follow the standard folder structure
* Use the standard file names
* Use normalized input
* Return normalized output
* Keep provider logic isolated
* Avoid dependencies on other providers
* Reuse shared utilities where appropriate

---

# Provider Restrictions

Providers must not:

* Access another provider directly
* Modify shared workflow logic
* Change the execution pipeline
* Duplicate shared utilities
* Introduce provider-specific architecture changes

---

# Supported MVP Providers

Version **1.0.0** includes the following providers:

* Stripe
* LemonSqueezy
* Paddle
* Polar

Future providers must follow this architecture without modification.

---

# Future Expansion

Additional providers may be added in future releases, including but not limited to:

* PayPal
* Square
* Mollie
* Razorpay
* Xendit
* Midtrans
* Paystack
* Flutterwave

Adding a new provider must not require changes to the existing provider architecture.

---

# Freeze Rules

After approval:

* Provider folder structure is fixed.
* File names are fixed.
* File responsibilities are fixed.
* Naming conventions are fixed.
* Provider lifecycle is fixed.
* Breaking architectural changes require a future major version.

---

# Freeze Status

| Item               | Status   |
| ------------------ | -------- |
| Provider Structure | ✅ Frozen |
| File Layout        | ✅ Frozen |
| Naming Convention  | ✅ Frozen |
| Responsibilities   | ✅ Frozen |
| Provider Lifecycle | ✅ Frozen |

---

**Version:** v1.0.0
**Status:** Official MVP Provider Architecture Freeze
