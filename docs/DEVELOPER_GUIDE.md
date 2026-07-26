
# Developer Guide

**Project:** InvoiceRouter
**Document:** DEVELOPER_GUIDE.md
**Version:** v1.0.0
**Status:** Architecture Locked (MVP)

---

# Purpose

This document defines the official development rules for InvoiceRouter.

Every developer, contributor, AI coding assistant, automation tool, and future maintainer **must follow this guide** before making any modification to the project.

This document exists to protect the project's architecture, maintainability, consistency, and long-term vision.

---

# Project Philosophy

InvoiceRouter is designed around four core principles:

* Modular Architecture
* Single Responsibility
* Configuration-Driven Design
* Long-Term Stability

Every implementation decision must support these principles.

---

# Architecture Status

The MVP architecture is officially **Frozen**.

The following areas are locked:

* Project Structure
* Folder Structure
* Node Architecture
* Provider Architecture
* Workflow
* Script Architecture
* Manifest Architecture
* Coding Standards
* Development Workflow
* Release Workflow

These documents are the project's source of truth.

---

# Development Rule #1

## Never Change The Architecture

Do not:

* Rename core folders
* Rename core files
* Change module boundaries
* Move responsibilities
* Introduce alternative architectures

Architecture changes require a future major version.

---

# Development Rule #2

## One Responsibility Per File

Each file must perform one responsibility only.

Examples:

Good

```text
StripePayload.ts
```

Build Stripe payload only.

Good

```text
StripeParser.ts
```

Parse Stripe responses only.

Bad

```text
StripeUtils.ts
```

Contains payload builder, parser, validator, and HTTP logic.

---

# Development Rule #3

## Never Mix Responsibilities

Providers must not:

* Build workflow logic
* Validate project structure
* Perform release tasks

Scripts must not:

* Implement provider logic
* Implement node logic

Shared modules must not:

* Store provider-specific logic

---

# Development Rule #4

## Never Hardcode Architecture

Never hardcode:

* Providers
* Nodes
* Folder lists
* Required files

Use manifest configuration whenever possible.

Example:

```text
manifest/

architecture.json
auto-fix.json
```

---

# Development Rule #5

## Keep Providers Isolated

Every provider must remain independent.

Provider A must never depend on Provider B.

Example:

```text
providers/

stripe/

providers/

paddle/
```

There should be no direct dependency between them.

---

# Development Rule #6

## Respect The Workflow

Every provider must follow the official workflow.

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

HTTP Request

↓

Response Parser

↓

Normalized Output
```

The workflow order must never change.

---

# Development Rule #7

## Respect Folder Ownership

Each folder owns one responsibility.

| Folder    | Responsibility    |
| --------- | ----------------- |
| nodes     | n8n nodes         |
| providers | Payment providers |
| shared    | Shared utilities  |
| scripts   | Automation        |
| manifest  | Configuration     |
| tests     | Testing           |
| docs      | Documentation     |

Never place files outside their ownership.

---

# Development Rule #8

## Shared Means Shared

The shared directory may contain only reusable components.

Allowed:

* Types
* Interfaces
* Constants
* Helpers
* Utilities

Not allowed:

* Stripe logic
* Paddle logic
* Business rules

---

# Development Rule #9

## Every Change Must Be Predictable

Changes should:

* Have one purpose
* Be easy to review
* Be easy to test
* Be easy to revert

Large unrelated changes should be avoided.

---

# Development Rule #10

## Preserve Public Behavior

Internal implementation may improve.

Public behavior must remain compatible unless a future major version explicitly changes it.

---

# PowerShell Rules

Every PowerShell script should:

* Return exit code
* Print a summary
* Stop on errors
* Follow the Script Architecture Freeze

Each script performs one responsibility.

---

# Provider Rules

Every provider must include:

```text
Provider/

index.ts

Provider.ts

ProviderPayload.ts

ProviderParser.ts

ProviderValidator.ts

ProviderTypes.ts

ProviderConstants.ts

ProviderHelpers.ts

README.md
```

Do not add or remove core files.

---

# Node Rules

Every node must include:

```text
Node/

index.ts

Node.node.ts

Node.description.ts

Node.execute.ts

Node.types.ts

Node.constants.ts

Node.helpers.ts

README.md
```

The node structure is frozen.

---

# Manifest Rules

Automation should read configuration from the manifest directory whenever applicable.

Avoid hardcoded configuration.

---

# Documentation Rules

Every architectural change approved for a future version must update:

* README
* Freeze documents
* API documentation
* Developer documentation

Documentation is part of the implementation.

---

# Code Review Checklist

Before merging code, verify:

* Architecture unchanged
* Responsibilities respected
* Naming conventions followed
* Build passes
* Tests pass
* Documentation updated if required

---

# Prohibited Changes

The following changes are not allowed in the MVP.

* Architecture redesign
* Folder restructuring
* Workflow redesign
* Node redesign
* Provider redesign
* Script redesign
* Manifest redesign
* Breaking API changes
* Breaking file naming
* Breaking directory naming

---

# Allowed Changes

The following changes are encouraged.

* Bug fixes
* Documentation improvements
* Performance improvements
* Test improvements
* Code readability
* Internal refactoring without changing behavior
* New providers following the frozen architecture

---

# AI Assistant Rules

When using AI coding assistants (Claude Code, GitHub Copilot, ChatGPT, Cursor, etc.), they must:

* Follow all Freeze documents.
* Respect the existing architecture.
* Avoid introducing new architectural patterns.
* Avoid renaming files or folders.
* Avoid changing public behavior without approval.
* Generate code that matches the existing project style.
* Prefer extending the current architecture over replacing it.

AI-generated code should be reviewed before merging.

---

# Source of Truth

When documents conflict, use the following priority order:

1. Freeze Documents
2. DEVELOPER_GUIDE.md
3. README.md
4. Project Source Code

---

# Related Documents

* README.md
* API.md
* INSTALL.md
* Feature-Freeze.md
* Node-Freeze.md
* Workflow-Freeze.md
* Provider-Architecture-Freeze.md
* Project-Structure-Freeze.md
* Development-Workflow-Freeze.md
* Release-Workflow-Freeze.md
* Script-Architecture-Freeze.md
* Manifest-Architecture-Freeze.md
* Coding-Standards-Freeze.md
* Versioning-Freeze.md
* Documentation-Freeze.md
* Contributing-Freeze.md

---

# Final Rule

If a proposed implementation conflicts with this guide or any Freeze document:

* Do not modify the architecture.
* Do not invent a new pattern.
* Do not replace existing modules.
* Follow the established project design.

When in doubt, preserve the existing architecture.

---

**Version:** v1.0.0
**Status:** Official Developer Guide (Architecture Locked)
