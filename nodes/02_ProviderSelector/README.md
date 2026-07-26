
# Provider Selector

Welcome to the **Provider Selector** node.

The **Provider Selector** is responsible for choosing the appropriate payment provider for the current workflow execution.

It receives the list of available providers from the **Provider Loader** and determines which provider should handle the requested operation.

The Provider Selector does **not** communicate with external APIs or implement provider-specific business logic.

---

# Purpose

The Provider Selector exists to:

* Select the appropriate provider.
* Validate the selected provider.
* Resolve provider configuration.
* Prepare provider execution.
* Forward the selected provider to the next workflow stage.

It acts as the decision layer between provider discovery and request execution.

---

# Workflow Position

```text
Workflow Input

↓

Provider Loader

↓

Provider Selector

↓

Request Builder

↓

Invoice Sender

↓

Status Checker

↓

Normalized Output
```

---

# Responsibilities

The Provider Selector is responsible for:

* Reading the provider selection request.
* Matching the requested provider.
* Verifying provider availability.
* Validating provider configuration.
* Returning a normalized provider reference.

The Provider Selector is **not** responsible for:

* Building payloads.
* Authenticating providers.
* Executing HTTP requests.
* Parsing API responses.
* Handling provider business logic.

---

# Input

The Provider Selector receives:

* Available provider list
* Workflow configuration
* Selected provider name
* Runtime context

Example:

```json
{
  "provider": "stripe",
  "availableProviders": [
    "stripe",
    "lemonsqueezy",
    "paddle",
    "polar"
  ]
}
```

---

# Output

The node returns the selected provider.

Example:

```json
{
  "provider": "stripe"
}
```

The output should remain normalized and independent of provider implementation.

---

# Execution Flow

```text
Receive Provider Request

↓

Validate Provider Name

↓

Verify Registration

↓

Verify Availability

↓

Resolve Provider

↓

Return Selected Provider
```

---

# Selection Rules

The Provider Selector should:

* Select only registered providers.
* Reject unknown providers.
* Reject disabled providers.
* Return a single provider.
* Produce deterministic results.

Provider selection should never rely on hardcoded assumptions.

---

# Validation

Before returning a provider, verify:

* Provider exists.
* Provider is registered.
* Provider is enabled.
* Provider configuration is valid.

If validation fails, execution should stop before reaching the Request Builder.

---

# Error Handling

Possible errors include:

* Provider not found
* Provider not registered
* Provider disabled
* Invalid provider configuration
* Missing provider selection

Errors should be normalized and easy to understand.

---

# Dependencies

The Provider Selector may depend on:

* Shared interfaces
* Shared types
* Provider registry
* Manifest configuration

It should not depend on:

* Provider payload builders
* Provider parsers
* Provider HTTP clients
* Individual provider implementations

---

# Development Rules

The Provider Selector should:

* Perform one responsibility.
* Remain provider-agnostic.
* Avoid network communication.
* Avoid business logic.
* Avoid provider-specific conditions.

Selection behavior should remain predictable and reproducible.

---

# Architecture Compliance

The Provider Selector must comply with:

* API.md
* DEVELOPER_GUIDE.md
* Node-Freeze.md
* Workflow-Freeze.md
* Provider-Architecture-Freeze.md

Its role in the execution pipeline is part of the project's frozen architecture.

---

# Future Expansion

Future enhancements may include:

* Capability-based provider selection
* Priority-based provider selection
* Automatic fallback selection
* Region-aware provider selection
* Feature compatibility checks

These enhancements should preserve the existing node responsibility and workflow position.

---

# Version

**Version:** v1.0.0

**Status:** Official Provider Selector Documentation
