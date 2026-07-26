
# Provider Loader

Welcome to the **Provider Loader** node.

The **Provider Loader** is the first execution node in the InvoiceRouter workflow. Its responsibility is to discover, initialize, and prepare supported payment providers for the remainder of the workflow.

This node does **not** execute payment operations or communicate with external provider APIs.

---

# Purpose

The Provider Loader exists to:

* Discover available providers.
* Load provider metadata.
* Validate provider registration.
* Prepare provider instances.
* Pass available providers to the next workflow stage.

It serves as the entry point to the provider system.

---

# Workflow Position

```text id="s2ap4d"
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

The Provider Loader is responsible for:

* Loading registered providers.
* Reading provider configuration.
* Initializing provider metadata.
* Verifying provider availability.
* Returning a normalized provider list.

The Provider Loader is **not** responsible for:

* Selecting a provider.
* Building request payloads.
* Authenticating providers.
* Calling provider APIs.
* Parsing responses.

---

# Input

The Provider Loader receives:

* Workflow execution context
* Project configuration
* Manifest configuration
* Registered provider definitions

It should not require provider-specific runtime data.

---

# Output

The node returns a normalized collection of available providers.

Example:

```json id="j4l0gb"
{
  "providers": [
    "stripe",
    "lemonsqueezy",
    "paddle",
    "polar"
  ]
}
```

The output should be provider-independent.

---

# Execution Flow

```text id="4v0ckr"
Start

↓

Read Manifest

↓

Load Provider Registry

↓

Validate Registration

↓

Initialize Providers

↓

Return Provider List
```

Each step should complete successfully before continuing.

---

# Provider Discovery

Providers should be discovered from the project's registration mechanism rather than hardcoded values.

Typical discovery sources include:

* Manifest configuration
* Provider registry
* Project configuration

The loader should not assume the existence of specific providers.

---

# Validation

Before returning results, the loader should verify:

* Provider registration
* Required metadata
* Configuration integrity
* Initialization status

Invalid providers should not be exposed to later workflow stages.

---

# Error Handling

If provider discovery fails, the node should return a clear and actionable error.

Examples include:

* No providers registered
* Invalid provider metadata
* Corrupted configuration
* Initialization failure

Provider-specific implementation errors should not occur within this node.

---

# Dependencies

The Provider Loader may depend on:

* Shared interfaces
* Shared utilities
* Manifest configuration
* Provider registry

It should not depend on:

* Individual provider implementations
* Payload builders
* Response parsers
* Provider API clients

---

# Development Rules

The Provider Loader should:

* Perform one responsibility.
* Remain provider-agnostic.
* Avoid business logic.
* Avoid network requests.
* Produce deterministic results.

Changes to provider loading behavior should remain backward compatible whenever possible.

---

# Architecture Compliance

The Provider Loader must comply with:

* API.md
* DEVELOPER_GUIDE.md
* Node-Freeze.md
* Workflow-Freeze.md
* Provider-Architecture-Freeze.md

Its role within the workflow is part of the project's frozen architecture.

---

# Future Expansion

Future enhancements may include:

* Dynamic provider discovery
* Provider capability metadata
* Version compatibility checks
* Provider health validation
* Optional provider filtering

These enhancements should extend the existing design without changing the node's core responsibility.

---

# Version

**Version:** v1.0.0

**Status:** Official Provider Loader Documentation
