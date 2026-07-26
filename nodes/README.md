# Nodes

Welcome to the **InvoiceRouter** node directory.

The **nodes/** directory contains the official **n8n Community Nodes** that expose InvoiceRouter functionality inside n8n.

Nodes are the public entry point of the project. They receive user input, coordinate execution, and return normalized results. Nodes should never contain provider-specific implementation details.

---

# Purpose

The node layer exists to:

* Expose InvoiceRouter inside n8n.
* Receive workflow input.
* Validate user configuration.
* Coordinate provider execution.
* Return normalized output.
* Provide a consistent user experience.

Nodes act as the orchestration layer between n8n and the provider system.

---

# Design Principles

Every node should be:

* Modular
* Lightweight
* Predictable
* Provider-agnostic
* Easy to maintain
* Focused on orchestration

Business logic belongs in the provider layer—not inside nodes.

---

# Directory Structure

```text id="s9mfht"
nodes/

README.md

ProviderLoader/
ProviderSelector/
RequestBuilder/
InvoiceSender/
StatusChecker/
```

Each node is implemented as an independent module.

---

# Node Structure

Every node follows the same internal structure.

```text id="k7u6cw"
Node/

README.md

index.ts

Node.node.ts
Node.description.ts
Node.execute.ts
Node.types.ts
Node.constants.ts
Node.helpers.ts
```

This structure is defined by **Node-Freeze.md** and should remain consistent across all nodes.

---

# Node Responsibilities

Each node is responsible for:

* Receiving workflow input.
* Reading node parameters.
* Validating required configuration.
* Calling the appropriate provider.
* Returning normalized output.
* Reporting execution errors.

Nodes should **not**:

* Build provider payloads.
* Parse provider responses.
* Handle provider authentication.
* Implement provider-specific business rules.

---

# Node Workflow

Nodes participate in the official execution pipeline.

```text id="tv6prx"
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

This workflow is part of the project's frozen architecture.

---

# Node Isolation

Each node should perform a single responsibility.

Examples:

```text id="gddrkl"
ProviderLoader

↓

Loads available providers
```

```text id="ck6h2t"
RequestBuilder

↓

Builds normalized request objects
```

```text id="lmqqf3"
StatusChecker

↓

Retrieves invoice status
```

Nodes should not duplicate functionality from other nodes.

---

# Node Communication

Nodes communicate through normalized data models.

They should exchange:

* Request objects
* Response objects
* Configuration
* Context

They should never exchange provider-specific payloads.

---

# Error Handling

Nodes should:

* Validate user input.
* Report configuration issues.
* Surface normalized provider errors.
* Return meaningful execution messages.

Unexpected provider exceptions should be handled before reaching the workflow.

---

# Naming Convention

Use descriptive names.

Examples:

```text id="q6gvwb"
ProviderLoader

RequestBuilder

InvoiceSender

StatusChecker
```

Avoid names such as:

```text id="4pvv5o"
Node1

MainNode

TempNode

ExampleNode
```

---

# Adding a New Node

When introducing a new node:

1. Create a dedicated node directory.
2. Follow the standard node structure.
3. Implement one clear responsibility.
4. Add documentation.
5. Add automated tests.
6. Preserve the existing workflow architecture.

New nodes should extend the project without changing the established design.

---

# Architecture Compliance

Every node must comply with:

* DEVELOPER_GUIDE.md
* API.md
* Node-Freeze.md
* Workflow-Freeze.md
* Coding-Standards-Freeze.md

Nodes are part of the project's frozen architecture and should not introduce alternative execution patterns.

---

# Contribution Guidelines

Before modifying a node:

* Preserve the existing structure.
* Keep responsibilities isolated.
* Avoid provider-specific logic.
* Maintain normalized interfaces.
* Update tests and documentation when behavior changes.

---

# Future Expansion

Future versions may introduce additional nodes for:

* Customer Management
* Subscription Management
* Refund Processing
* Webhook Management
* Provider Configuration
* Analytics

All future nodes should follow the same architecture and development standards.

---

# Version

**Version:** v1.0.0

**Status:** Official Node Documentation
