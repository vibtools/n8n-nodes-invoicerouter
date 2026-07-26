# Status Checker

Welcome to the **Status Checker** node.

The **Status Checker** is the final execution node in the InvoiceRouter workflow. Its responsibility is to retrieve, normalize, and return the current status of an invoice after provider execution.

The Status Checker provides a consistent output regardless of which payment provider processed the request.

It does **not** implement provider-specific business logic or communicate directly with provider APIs outside the provider abstraction layer.

---

# Purpose

The Status Checker exists to:

* Retrieve the current invoice status.
* Normalize provider responses.
* Produce a consistent workflow output.
* Verify invoice execution results.
* Complete the InvoiceRouter workflow.

It serves as the final output stage of the execution pipeline.

---

# Workflow Position

```text id="s2kc4v"
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

The Status Checker is responsible for:

* Receiving the provider execution result.
* Obtaining the invoice status.
* Normalizing provider status values.
* Returning the final workflow output.
* Reporting execution status.

The Status Checker is **not** responsible for:

* Loading providers.
* Selecting providers.
* Building requests.
* Sending invoices.
* Parsing raw provider responses.
* Implementing provider-specific status logic.

---

# Input

The Status Checker receives:

* Selected provider
* Provider execution result
* Invoice identifier
* Runtime context

Example:

```json id="d4qt9m"
{
  "provider": "stripe",
  "invoiceId": "inv_12345"
}
```

---

# Output

The node returns a normalized invoice status.

Example:

```json id="5gwqnr"
{
  "provider": "stripe",
  "invoiceId": "inv_12345",
  "status": "paid",
  "currency": "USD",
  "invoiceUrl": "https://example.com/invoice"
}
```

The output format should remain consistent across all supported providers.

---

# Execution Flow

```text id="4k1h0d"
Receive Provider Result

↓

Request Status

↓

Normalize Status

↓

Validate Response

↓

Return Final Output
```

The workflow should always produce a predictable and provider-independent result.

---

# Status Normalization

Provider-specific status values should be mapped to a common status model.

Example normalized statuses:

* Draft
* Open
* Pending
* Paid
* Cancelled
* Void
* Failed

The workflow should never expose provider-specific status names unless explicitly required.

---

# Validation

Before returning the final result, verify:

* Invoice identifier exists.
* Status is available.
* Response structure is valid.
* Required fields are present.
* Output matches the normalized response model.

Invalid responses should not be returned to the workflow.

---

# Error Handling

Possible errors include:

* Invoice not found
* Invalid invoice identifier
* Provider execution failure
* Timeout
* Invalid response
* Unsupported status

Errors should follow the project's normalized error model.

---

# Dependencies

The Status Checker may depend on:

* Shared interfaces
* Shared types
* Provider abstraction
* Shared utilities

It should not depend on:

* Individual provider implementations
* Provider payload builders
* Provider authentication logic
* Workflow orchestration outside its responsibility

---

# Development Rules

The Status Checker should:

* Perform one responsibility.
* Remain provider-agnostic.
* Produce deterministic output.
* Avoid provider-specific business logic.
* Return normalized responses only.

Its behavior should remain stable regardless of the selected provider.

---

# Architecture Compliance

The Status Checker must comply with:

* API.md
* DEVELOPER_GUIDE.md
* Node-Freeze.md
* Workflow-Freeze.md
* Provider-Architecture-Freeze.md

Its position as the final node in the execution pipeline is part of the project's frozen architecture.

---

# Future Expansion

Future enhancements may include:

* Status history
* Timeline events
* Payment confirmation details
* Retry status checks
* Webhook synchronization
* Extended invoice metadata

These enhancements should extend the existing functionality without changing the node's core responsibility.

---

# Version

**Version:** v1.0.0

**Status:** Official Status Checker Documentation
