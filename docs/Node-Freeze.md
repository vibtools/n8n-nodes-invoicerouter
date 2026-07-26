# Node Freeze

**Project:** InvoiceRouter
**Status:** Frozen (MVP)
**Version:** v1.0.0

---

# Purpose

This document defines the official node architecture for the InvoiceRouter MVP.

Only the nodes listed here are included in Version **1.0.0**.

No additional nodes may be introduced into the MVP after this document is frozen.

---

# Design Principles

Every node must follow the same architecture.

Each node should:

* Have a single responsibility
* Be modular
* Be reusable
* Be independently maintainable
* Follow the same file structure
* Follow the same naming convention

---

# MVP Nodes

## 1. Provider Loader

### Responsibility

Loads available providers into the workflow.

### Purpose

* Discover providers
* Register providers
* Prepare provider information

---

## 2. Provider Selector

### Responsibility

Selects the requested provider.

### Purpose

* Validate provider name
* Select provider implementation
* Pass provider instance to the workflow

---

## 3. Request Builder

### Responsibility

Builds the provider-specific invoice payload.

### Purpose

* Convert normalized input
* Generate provider payload
* Validate required fields

---

## 4. Invoice Sender

### Responsibility

Sends the invoice request to the selected provider.

### Purpose

* Execute API request
* Receive response
* Handle provider communication

---

## 5. Status Checker

### Responsibility

Retrieves and normalizes invoice status.

### Purpose

* Query invoice status
* Parse provider response
* Return normalized output

---

# Standard Node Structure

Every node must use the following structure.

```text
NodeName/

index.ts

NodeName.node.ts

NodeName.description.ts

NodeName.execute.ts

NodeName.types.ts

NodeName.constants.ts

NodeName.helpers.ts

README.md
```

No additional core files should be added unless required by a future major version.

---

# Node Responsibilities

| Node              | Responsibility                 |
| ----------------- | ------------------------------ |
| Provider Loader   | Load available providers       |
| Provider Selector | Select provider implementation |
| Request Builder   | Build provider payload         |
| Invoice Sender    | Execute invoice request        |
| Status Checker    | Retrieve invoice status        |

---

# Data Flow

```text
Provider Loader
        │
        ▼
Provider Selector
        │
        ▼
Request Builder
        │
        ▼
Invoice Sender
        │
        ▼
Status Checker
```

Every invoice request must follow this sequence.

---

# Node Rules

Each node must:

* Perform one responsibility only
* Avoid business logic belonging to another node
* Avoid provider-specific implementation outside its responsibility
* Avoid direct coupling with other nodes
* Use shared utilities when applicable
* Return normalized data whenever possible

---

# Not Included in MVP

The following nodes are excluded from Version 1.0.0:

* Customer Manager
* Subscription Manager
* Refund Manager
* Webhook Manager
* Analytics
* Dashboard
* Reporting
* Notification
* CLI Nodes

These may be introduced in future versions without changing the frozen MVP node architecture.

---

# Freeze Rules

After approval:

* No new MVP nodes may be added.
* Existing node responsibilities may not change.
* Node names may not change.
* Node order may not change.
* Node architecture may not change.

---

# Freeze Status

| Item                  | Status   |
| --------------------- | -------- |
| Node List             | ✅ Frozen |
| Node Order            | ✅ Frozen |
| Node Responsibilities | ✅ Frozen |
| Node Architecture     | ✅ Frozen |

---

**Version:** v1.0.0
**Status:** Official MVP Node Freeze
