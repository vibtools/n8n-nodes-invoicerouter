# Coding Standards Freeze

**Project:** InvoiceRouter
**Status:** Frozen (MVP)
**Version:** v1.0.0

---

# Purpose

This document defines the official coding standards for the InvoiceRouter MVP.

Every source file, provider, node, script, and shared component must follow these standards to ensure consistency across the project.

These standards apply to all current and future contributors.

---

# Core Principles

The codebase should always be:

* Simple
* Modular
* Readable
* Maintainable
* Predictable
* Reusable
* Consistent

Readability is preferred over unnecessary complexity.

---

# Single Responsibility Principle

Every file must have exactly one responsibility.

Examples:

* One node
* One provider
* One helper
* One validator
* One parser
* One payload builder

Avoid combining multiple responsibilities into a single file.

---

# Directory Ownership

Every file belongs to one logical module.

Examples:

* Node files belong inside `nodes/`
* Provider files belong inside `providers/`
* Shared utilities belong inside `shared/`
* Documentation belongs inside `docs/`
* Automation belongs inside `scripts/`

Files must not cross module boundaries.

---

# Naming Convention

## Directories

Use lowercase names.

Example

```text id="a2s0m4"
providers
shared
scripts
manifest
tests
```

---

## Files

Use descriptive names.

Examples

```text id="4v8g3h"
ProviderLoader.node.ts
ProviderLoader.execute.ts
StripeProvider.ts
StripePayload.ts
StripeValidator.ts
build.ps1
release.ps1
```

Names should clearly describe their responsibility.

---

# TypeScript

TypeScript source should:

* Use explicit types where appropriate
* Prefer interfaces for shared contracts
* Avoid unnecessary `any`
* Keep functions focused
* Keep files small and modular

---

# PowerShell

Every PowerShell script should:

* Set `$ErrorActionPreference = "Stop"`
* Return proper exit codes
* Display clear console messages
* Print a summary before exiting
* Follow the project's script architecture

---

# Shared Code

Shared components should contain only reusable functionality.

Examples:

* Types
* Interfaces
* Constants
* Helpers
* Utilities

Business logic should not be placed inside shared modules.

---

# Error Handling

Every module should:

* Detect errors early
* Return meaningful messages
* Avoid silent failures
* Fail safely

Unexpected errors should not leave the project in an inconsistent state.

---

# Documentation

Every major module should include documentation.

Examples:

* README.md
* Provider documentation
* Node documentation
* Freeze documents

Documentation should remain synchronized with the implementation.

---

# Code Review Guidelines

Before code is accepted:

* Architecture is respected
* Naming follows conventions
* Responsibilities remain isolated
* Documentation is updated if required
* No unnecessary complexity is introduced

---

# Prohibited Practices

The following practices are not allowed:

* Duplicate code
* Circular dependencies
* Hardcoded project architecture
* Mixing unrelated responsibilities
* Hidden side effects
* Large monolithic files
* Breaking the frozen architecture

---

# Future Changes

Future versions may:

* Improve implementation
* Optimize performance
* Add documentation
* Expand providers
* Expand nodes

Future work must continue to follow these coding standards.

---

# Freeze Rules

After approval:

* Coding principles are fixed.
* Naming conventions are fixed.
* Responsibility boundaries are fixed.
* Code organization rules are fixed.
* Breaking changes require a future major version.

---

# Freeze Status

| Item                 | Status   |
| -------------------- | -------- |
| Coding Principles    | ✅ Frozen |
| Naming Convention    | ✅ Frozen |
| Responsibility Rules | ✅ Frozen |
| Documentation Rules  | ✅ Frozen |

---

**Version:** v1.0.0
**Status:** Official MVP Coding Standards Freeze
