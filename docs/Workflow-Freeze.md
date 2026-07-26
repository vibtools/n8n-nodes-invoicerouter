# Workflow Freeze

**Project:** InvoiceRouter
**Status:** Frozen (MVP)
**Version:** v1.0.0

---

# Purpose

This document defines the official execution workflow for the InvoiceRouter MVP.

Every supported payment provider must follow this workflow without exception.

The workflow is provider-independent and represents the standard invoice processing pipeline used throughout the project.

---

# MVP Workflow

```text
Input
   │
   ▼
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
   │
   ▼
Normalized Output
```

This workflow is the only supported execution flow for Version **1.0.0**.

---

# Workflow Steps

## Step 1 — Input

Receive normalized invoice data from the n8n workflow.

Typical input may include:

* Provider
* Customer
* Invoice
* Currency
* Items
* Metadata

The input format must remain provider-independent.

---

## Step 2 — Provider Loader

Load all available provider implementations.

Responsibilities:

* Discover providers
* Register providers
* Prepare provider registry

Output:

* Provider collection

---

## Step 3 — Provider Selector

Select the requested provider.

Responsibilities:

* Validate provider name
* Locate provider implementation
* Return provider instance

Output:

* Active provider

---

## Step 4 — Request Builder

Generate the provider-specific request.

Responsibilities:

* Validate input
* Convert normalized data
* Build provider payload

Output:

* Provider request payload

---

## Step 5 — Invoice Sender

Execute the provider request.

Responsibilities:

* Send API request
* Receive response
* Handle communication errors

Output:

* Raw provider response

---

## Step 6 — Status Checker

Normalize the provider response.

Responsibilities:

* Read invoice status
* Parse provider response
* Normalize output

Output:

* Standardized invoice result

---

## Step 7 — Normalized Output

Return a consistent output structure regardless of provider.

The workflow should expose a unified response format for all supported providers.

---

# Execution Flow

```text
Receive Input
        │
        ▼
Load Providers
        │
        ▼
Select Provider
        │
        ▼
Build Request
        │
        ▼
Send Invoice
        │
        ▼
Receive Response
        │
        ▼
Normalize Result
        │
        ▼
Return Output
```

---

# Responsibility Boundaries

| Step              | Responsibility                   |
| ----------------- | -------------------------------- |
| Input             | Receive normalized workflow data |
| Provider Loader   | Register providers               |
| Provider Selector | Choose provider                  |
| Request Builder   | Build provider payload           |
| Invoice Sender    | Execute request                  |
| Status Checker    | Normalize response               |
| Output            | Return standardized result       |

---

# Workflow Rules

The workflow must always:

* Execute in the defined order
* Use normalized input
* Produce normalized output
* Support all providers through the same pipeline
* Keep provider-specific logic isolated within provider implementations

---

# Workflow Restrictions

The workflow must not:

* Skip workflow stages
* Change execution order
* Mix provider logic between stages
* Embed provider-specific logic in shared workflow components
* Introduce parallel execution paths in the MVP

---

# Future Extensions

Future versions may introduce:

* Additional workflow operations
* New provider capabilities
* Optional workflow branches
* Retry strategies
* Batch invoice processing

These enhancements must remain compatible with the frozen MVP workflow.

---

# Freeze Rules

After approval:

* Workflow order is fixed.
* Workflow stages are fixed.
* Stage responsibilities are fixed.
* Input and output normalization must remain consistent.
* Breaking changes require a future major version.

---

# Freeze Status

| Item                   | Status   |
| ---------------------- | -------- |
| Workflow Order         | ✅ Frozen |
| Execution Pipeline     | ✅ Frozen |
| Stage Responsibilities | ✅ Frozen |
| Input Format           | ✅ Frozen |
| Output Format          | ✅ Frozen |

---

**Version:** v1.0.0
**Status:** Official MVP Workflow Freeze
