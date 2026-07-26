
# Tests

Welcome to the **InvoiceRouter** testing directory.

This folder contains all automated tests used to verify the correctness, stability, and reliability of the project.

Testing is considered a core part of the development lifecycle. Every feature should be validated before it is merged or released.

---

# Purpose

The test suite exists to:

* Verify project correctness.
* Prevent regressions.
* Validate provider implementations.
* Verify workflow behavior.
* Ensure architecture stability.
* Improve long-term maintainability.

---

# Testing Philosophy

InvoiceRouter follows these testing principles:

* Automated whenever possible.
* Independent and repeatable.
* Fast to execute.
* Easy to understand.
* Easy to maintain.
* Deterministic (same input produces the same result).

Tests should never depend on another test.

---

# Directory Structure

```text
tests/

README.md

unit/
integration/
providers/
workflow/
fixtures/
helpers/
```

---

# Test Categories

## Unit Tests

Verify individual components in isolation.

Examples:

* Validators
* Payload builders
* Response parsers
* Utilities
* Shared helpers

---

## Integration Tests

Verify interaction between multiple components.

Examples:

* Node → Provider
* Provider → HTTP Client
* Manifest → Loader
* Shared Modules

---

## Provider Tests

Each provider should maintain its own test suite.

Example structure:

```text
tests/providers/

stripe/
lemonsqueezy/
paddle/
polar/
```

Each provider should verify:

* Validation
* Payload generation
* Response parsing
* Error handling
* Normalized output

---

## Workflow Tests

Workflow tests verify the complete execution pipeline.

```text
Input

↓

Provider Loader

↓

Provider Selector

↓

Validator

↓

Payload Builder

↓

HTTP Client

↓

Parser

↓

Normalized Output
```

The workflow should behave consistently regardless of the selected provider.

---

## Fixtures

Fixtures contain reusable test data.

Examples:

* Sample invoices
* Mock responses
* Provider payloads
* Configuration samples

Fixtures should not contain production credentials or sensitive information.

---

## Helpers

Shared testing utilities.

Examples:

* Mock builders
* Test factories
* Assertion helpers
* Shared setup
* Shared teardown

Business logic should never be implemented inside test helpers.

---

# Naming Convention

Use descriptive names.

Examples:

```text
ProviderValidator.test.ts

StripeParser.test.ts

InvoiceWorkflow.test.ts

PayloadBuilder.test.ts
```

Avoid names such as:

```text
test.ts

demo.ts

sample.ts

temp.ts
```

---

# Test Coverage

The following areas should be covered:

* Validators
* Payload builders
* Response parsers
* Error handling
* Provider normalization
* Workflow execution
* Shared utilities
* Manifest loading
* Configuration validation

Every new feature should include corresponding tests.

---

# Test Rules

Tests should:

* Have one purpose.
* Be independent.
* Avoid duplicated logic.
* Produce consistent results.
* Use mock data whenever possible.
* Avoid external dependencies unless required.

---

# Mocking

External services should be mocked during testing.

Examples include:

* Payment provider APIs
* HTTP requests
* Authentication
* Configuration loading

Tests should not rely on external network availability.

---

# Continuous Integration

Every Pull Request should execute:

* Formatting
* Linting
* Build
* Test Suite

A Pull Request should not be merged if any required test fails.

---

# Running Tests

Using npm:

```bash
npm test
```

Using PowerShell:

```powershell
.\scripts\test.ps1
```

Run the full validation pipeline before creating a release.

---

# Architecture Compliance

Tests must follow:

* DEVELOPER_GUIDE.md
* API.md
* Workflow-Freeze.md
* Provider-Architecture-Freeze.md
* Coding-Standards-Freeze.md

Tests should validate the documented architecture rather than introduce alternative implementations.

---

# Contribution Guidelines

When adding tests:

* Keep each test focused.
* Cover both success and failure scenarios.
* Reuse shared fixtures when appropriate.
* Update this README if the test structure changes.
* Ensure new functionality includes corresponding tests.

---

# Future Expansion

The testing framework may expand to include:

* Performance tests
* Load tests
* End-to-end workflow tests
* Security validation
* Compatibility testing
* Snapshot testing

These additions should follow the existing testing architecture.

---

# Version

**Version:** v1.0.0

**Status:** Official Testing Documentation
