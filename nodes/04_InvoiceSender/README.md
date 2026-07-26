# Invoice Sender

> **Audited MVP behavior:** This node currently produces a normalized dry-run result. It does not call external provider APIs. Live transport remains a provider-specific implementation task.

Welcome to the **Invoice Sender** node.

The **Invoice Sender** is responsible for executing the invoice request through the selected payment provider.

It receives a validated, normalized request from the **Request Builder**, delegates execution to the selected provider, and returns the provider response for further processing.

The Invoice Sender coordinates provider execution but does **not** implement provider-specific business logic.

---

# Purpose

The Invoice Sender exists to:

* Execute invoice operations.
* Invoke the selected provider.
* Coordinate provider communication.
* Handle execution results.
* Return a normalized provider response.

It serves as the execution layer between request preparation and response processing.

---

# Workflow Position

```text id="t9m3xp"
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

The Invoice Sender is responsible for:

* Receiving the normalized request.
* Loading the selected provider.
* Delegating execution to the provider.
* Receiving the provider response.
* Returning a normalized execution result.

The Invoice Sender is **not** responsible for:

* Provider discovery.
* Provider selection.
* Request validation.
* Provider payload generation.
* Response parsing.
* Provider authentication implementation.

---

# Input

The Invoice Sender receives:

* Selected provider
* Normalized request
* Execution context
* Runtime configuration

Example:

```json id="c2y8kn"
{
  "provider": "stripe",
  "request": {
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
}
```

---

# Output

The node returns the provider execution result.

Example:

```json id="m7f2we"
{
  "provider": "stripe",
  "result": {
    "invoiceId": "inv_12345",
    "status": "created"
  }
}
```

The response remains normalized before entering the next workflow stage.

---

# Execution Flow

```text id="5zj4ar"
Receive Request

↓

Load Selected Provider

↓

Execute Provider

↓

Receive Provider Response

↓

Return Normalized Result
```

The Invoice Sender should only coordinate execution. Provider-specific processing belongs inside the provider module.

---

# Provider Communication

The Invoice Sender communicates only with the selected provider interface.

It should never:

* Build provider payloads.
* Call provider APIs directly.
* Parse provider responses.
* Handle authentication logic.

These responsibilities belong to the provider implementation.

---

# Execution Rules

The Invoice Sender should:

* Execute only one provider.
* Execute one request at a time.
* Forward the normalized request unchanged.
* Return normalized execution results.
* Preserve workflow consistency.

---

# Error Handling

Possible execution errors include:

* Provider execution failure
* Network failure
* Timeout
* Authentication failure
* Provider unavailable
* Unexpected provider exception

Errors should be returned using the project's normalized error model.

---

# Dependencies

The Invoice Sender may depend on:

* Shared interfaces
* Shared types
* Provider registry
* Provider abstraction

It should not depend on:

* Individual provider implementations
* Payload builders
* Response parsers
* Workflow orchestration outside its own responsibility

---

# Development Rules

The Invoice Sender should:

* Perform one responsibility.
* Remain provider-agnostic.
* Avoid business logic.
* Avoid provider-specific conditions.
* Avoid data transformation outside execution coordination.

Execution behavior should remain deterministic and consistent across providers.

---

# Architecture Compliance

The Invoice Sender must comply with:

* API.md
* DEVELOPER_GUIDE.md
* Node-Freeze.md
* Workflow-Freeze.md
* Provider-Architecture-Freeze.md

Its execution role is part of the project's frozen architecture.

---

# Future Expansion

Future enhancements may include:

* Retry policies
* Execution metrics
* Request tracing
* Cancellation support
* Batch execution
* Provider timeout configuration

These enhancements should extend execution capabilities without changing the node's core responsibility.

---

# Version

**Version:** v1.0.0

**Status:** Official Invoice Sender Documentation
