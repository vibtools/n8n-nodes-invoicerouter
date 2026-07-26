# Providers

Welcome to the **InvoiceRouter** provider directory.

The **providers/** directory contains all payment provider implementations supported by InvoiceRouter.

Each provider is an isolated module responsible for communicating with a specific payment platform while exposing a common, normalized interface to the rest of the application.

---

# Purpose

The provider layer exists to:

* Integrate with external payment platforms.
* Convert normalized requests into provider-specific API calls.
* Normalize provider responses.
* Isolate provider-specific business logic.
* Keep the rest of the project provider-agnostic.

The application should never communicate directly with a payment provider outside this layer.

---

# Design Principles

Every provider must be:

* Independent
* Modular
* Replaceable
* Testable
* Easy to maintain
* Consistent with the shared architecture

Providers must never depend on one another.

---

# Directory Structure

```text id="sl3f5u"
providers/

README.md

stripe/
lemonsqueezy/
paddle/
polar/
```

Each provider is implemented in its own isolated directory.

---

# Provider Structure

Every provider follows the same internal structure.

```text id="2o3svv"
provider/

README.md

index.ts

Provider.ts
ProviderPayload.ts
ProviderParser.ts
ProviderValidator.ts
ProviderTypes.ts
ProviderConstants.ts
ProviderHelpers.ts
```

This structure is defined by the **Provider-Architecture-Freeze.md** document and should remain consistent across all providers.

---

# Provider Responsibilities

Every provider is responsible for:

* Validating requests
* Building provider-specific payloads
* Managing authentication
* Executing API requests
* Parsing responses
* Normalizing output
* Handling provider-specific errors

Providers should not perform workflow orchestration or application-level decision making.

---

# Provider Lifecycle

Each provider follows the same execution pipeline.

```text id="w4knfk"
Normalized Input

↓

Provider Validator

↓

Payload Builder

↓

Authentication

↓

HTTP Request

↓

Provider API

↓

Response Parser

↓

Normalized Output
```

Every provider must preserve this lifecycle.

---

# Provider Isolation

Providers are completely independent.

Example:

```text id="a8v73v"
providers/

stripe/
paddle/
lemonsqueezy/
polar/
```

The following are **not allowed**:

* Importing another provider.
* Sharing provider-specific logic.
* Reusing provider-specific payloads.
* Calling another provider internally.

Shared functionality belongs in the **shared/** directory.

---

# Normalized Interface

Although every payment platform has different APIs, each provider should expose the same logical behavior to the application.

Common operations include:

* Create Invoice
* Retrieve Invoice
* Update Invoice
* Cancel Invoice
* Check Invoice Status

Provider-specific API differences must remain hidden inside the provider implementation.

---

# Authentication

Authentication is handled inside each provider.

Examples include:

* API Keys
* Bearer Tokens
* OAuth
* Basic Authentication

Authentication logic must not be duplicated outside the provider.

---

# Error Handling

Each provider should convert platform-specific errors into a normalized error format.

The application should never receive raw provider-specific exceptions unless explicitly required for debugging.

---

# Naming Convention

Use clear and descriptive names.

Examples:

```text id="d7f5tl"
StripeValidator.ts

StripePayload.ts

StripeParser.ts

StripeHelpers.ts
```

Avoid generic names such as:

```text id="1uyf2e"
provider.ts

utils.ts

helper.ts

common.ts
```

---

# Adding a New Provider

When introducing a new provider:

1. Create a dedicated directory.
2. Follow the standard provider structure.
3. Implement all required modules.
4. Add provider tests.
5. Add provider documentation.
6. Update the project documentation where applicable.

New providers should integrate with the existing architecture without modifying it.

---

# Architecture Compliance

Every provider must comply with:

* API.md
* DEVELOPER_GUIDE.md
* Provider-Architecture-Freeze.md
* Workflow-Freeze.md
* Coding-Standards-Freeze.md

The provider layer is part of the project's frozen architecture.

---

# Contribution Guidelines

Before modifying a provider:

* Preserve the existing structure.
* Avoid breaking normalized interfaces.
* Keep provider-specific logic isolated.
* Update tests when behavior changes.
* Document significant changes.

---

# Future Expansion

Future versions may include support for additional providers.

Examples:

* PayPal
* Square
* Razorpay
* Mollie
* Braintree

New providers should follow the same architecture and implementation standards defined for the existing providers.

---

# Version

**Version:** v1.0.0

**Status:** Official Provider Documentation
