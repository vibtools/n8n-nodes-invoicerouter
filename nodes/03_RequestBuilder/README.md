
# Request Builder

Welcome to the **Request Builder** node.

The **Request Builder** is responsible for transforming normalized workflow input into a validated request object that can be processed by the selected provider.

This node prepares the request for execution while remaining completely independent of provider-specific payload formats.

The Request Builder does **not** communicate with external APIs or generate provider-specific request bodies.

---

# Purpose

The Request Builder exists to:

* Collect normalized workflow data.
* Validate required request fields.
* Build a normalized request model.
* Prepare data for provider execution.
* Pass a consistent request object to the next workflow stage.

It serves as the bridge between workflow input and provider execution.

---

# Workflow Position

```text id="m7h2zp"
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

The Request Builder is responsible for:

* Reading workflow input.
* Validating required request fields.
* Creating a normalized request object.
* Applying default values where appropriate.
* Returning a provider-independent request.

The Request Builder is **not** responsible for:

* Building provider payloads.
* Authenticating providers.
* Sending HTTP requests.
* Parsing provider responses.
* Implementing provider-specific business rules.

---

# Input

The Request Builder receives:

* Selected provider
* Workflow parameters
* Invoice information
* Customer information
* Runtime context

Example:

```json id="4h6m1n"
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

---

# Output

The node returns a normalized request model.

Example:

```json id="w8q5vr"
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

The output should remain provider-independent.

---

# Execution Flow

```text id="s5pqtw"
Receive Workflow Input

↓

Validate Required Fields

↓

Normalize Input

↓

Apply Default Values

↓

Build Request Object

↓

Return Normalized Request
```

---

# Validation

Before returning the request object, verify:

* Required fields exist.
* Input types are valid.
* Mandatory values are present.
* Request structure is complete.
* Normalized model is valid.

Invalid requests must not continue to the next workflow stage.

---

# Normalization

The Request Builder should normalize:

* Customer information
* Invoice details
* Currency
* Items
* Metadata
* Optional fields

Provider-specific transformations belong to the provider layer.

---

# Error Handling

Possible validation errors include:

* Missing required fields
* Invalid request structure
* Unsupported values
* Invalid data types
* Empty request

Errors should be returned using the project's normalized error model.

---

# Dependencies

The Request Builder may depend on:

* Shared interfaces
* Shared types
* Shared validation utilities
* Manifest configuration

It should not depend on:

* Provider implementations
* Payload builders
* HTTP clients
* Response parsers

---

# Development Rules

The Request Builder should:

* Perform one responsibility.
* Produce deterministic output.
* Remain provider-agnostic.
* Avoid business logic outside request construction.
* Avoid network operations.

The request model should remain stable and predictable.

---

# Architecture Compliance

The Request Builder must comply with:

* API.md
* DEVELOPER_GUIDE.md
* Node-Freeze.md
* Workflow-Freeze.md
* Provider-Architecture-Freeze.md

Its responsibility is part of the project's frozen architecture.

---

# Future Expansion

Future enhancements may include:

* Schema validation
* Dynamic default values
* Custom metadata support
* Request templates
* Additional invoice attributes

These enhancements should extend the normalized request model without changing the node's core responsibility.

---

# Version

**Version:** v1.0.0

**Status:** Official Request Builder Documentation
