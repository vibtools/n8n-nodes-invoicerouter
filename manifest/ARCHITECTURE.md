# ARCHITECTURE

**Project:** InvoiceRouter
**Document:** ARCHITECTURE.md
**Version:** v1.0.0
**Status:** Architecture Locked (MVP)

---

# Purpose

This document is the **technical architecture specification** for InvoiceRouter.

It is intended for:

* Developers
* Maintainers
* Contributors
* AI Coding Assistants
* CI/CD Automation
* Static Analysis Tools
* Future Project Maintainers

This document explains **how the project is organized**, **why it is organized this way**, and **how every component should interact**.

This is **not** a user guide.

---

# Architecture Goals

The architecture is designed around the following objectives:

* Predictable
* Modular
* Maintainable
* Testable
* Provider Independent
* Scalable
* Configuration Driven
* AI Friendly
* CI/CD Friendly
* Long-Term Stable

---

# Core Design Principles

InvoiceRouter follows these principles.

## 1. Single Responsibility

Every folder, module, class, file and function has one clear responsibility.

Example

```text
RequestBuilder

✓ Build normalized request

✗ Execute HTTP
✗ Parse response
✗ Authenticate provider
```

---

## 2. Provider Isolation

Every payment provider is completely independent.

```text
Stripe

↓

Own Validator

↓

Own Payload Builder

↓

Own Parser
```

Providers never import one another.

---

## 3. Node Isolation

Nodes coordinate workflow only.

Nodes never contain:

* Provider business logic
* Provider payloads
* Provider authentication
* Provider parsing

---

## 4. Manifest Driven

Project metadata should come from

```text
manifest/
```

instead of hardcoded values.

---

## 5. Layer Separation

Each layer owns exactly one concern.

---

# High Level Architecture

```text
┌───────────────────────────────┐
│            n8n                │
└───────────────┬───────────────┘
                │
                ▼
      Provider Loader Node
                │
                ▼
     Provider Selector Node
                │
                ▼
      Request Builder Node
                │
                ▼
       Invoice Sender Node
                │
                ▼
       Status Checker Node
                │
                ▼
       Normalized Response
                │
                ▼
          n8n Workflow
```

---

# Directory Architecture

```text
InvoiceRouter/

assets/
docs/
examples/
logs/
manifest/
nodes/
providers/
scripts/
shared/
temp/
tests/
user-docs/

README.md
package.json
tsconfig.json
```

Every top-level directory owns one responsibility.

---

# Directory Responsibilities

| Directory | Responsibility            |
| --------- | ------------------------- |
| assets    | Static project assets     |
| docs      | Developer documentation   |
| examples  | Reference implementations |
| logs      | Runtime & automation logs |
| manifest  | Project metadata          |
| nodes     | n8n nodes                 |
| providers | Payment providers         |
| scripts   | Development automation    |
| shared    | Shared reusable modules   |
| temp      | Temporary files           |
| tests     | Automated testing         |
| user-docs | End-user documentation    |

---

# Layer Architecture

```text
                User

                  │

                  ▼

               n8n UI

                  │

                  ▼

               Nodes

                  │

                  ▼

            Provider Layer

                  │

                  ▼

             Shared Layer

                  │

                  ▼

           External Provider
```

Each layer depends only on lower layers.

---

# Dependency Rules

Allowed

```text
Nodes

↓

Providers

↓

Shared
```

Allowed

```text
Scripts

↓

Manifest
```

Not Allowed

```text
Providers

↓

Nodes
```

Not Allowed

```text
Shared

↓

Providers
```

Not Allowed

```text
Shared

↓

Nodes
```

Circular dependencies are prohibited.

---

# Node Architecture

Each node follows the same structure.

```text
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

Every node exposes one workflow responsibility.

---

# Workflow Architecture

```text
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

Workflow order is frozen.

---

# Provider Architecture

Every provider follows:

```text
Provider/

README.md

index.ts

Provider.ts

ProviderValidator.ts

ProviderPayload.ts

ProviderParser.ts

ProviderTypes.ts

ProviderConstants.ts

ProviderHelpers.ts
```

Execution pipeline:

```text
Normalized Request

↓

Validate

↓

Build Payload

↓

Authenticate

↓

HTTP Request

↓

Parse Response

↓

Normalized Response
```

---

# Shared Architecture

The shared layer contains only reusable components.

Allowed:

* Types
* Interfaces
* Helpers
* Constants
* Utilities
* Generic Validators
* Generic Errors

Forbidden:

* Stripe Logic
* Paddle Logic
* Node Logic
* Workflow Logic

---

# Manifest Architecture

The manifest layer is the configuration source.

Example:

```text
manifest/

architecture.json

auto-fix.json
```

Automation should consume manifests instead of hardcoded project information.

---

# Script Architecture

Scripts are independent automation modules.

Examples

```text
install.ps1

↓

Install dependencies

build.ps1

↓

Compile

test.ps1

↓

Run tests

release.ps1

↓

Prepare release
```

Each script performs one task.

---

# Documentation Architecture

Two documentation systems exist.

```text
docs/

↓

Developer Documentation
```

```text
user-docs/

↓

End User Documentation
```

Developer documentation explains implementation.

User documentation explains usage.

---

# Testing Architecture

Testing is separated from implementation.

```text
tests/

unit/

integration/

providers/

workflow/
```

Tests validate behavior but do not implement features.

---

# Logging Architecture

Generated logs belong only in

```text
logs/
```

Logs are never part of runtime behavior.

Deleting logs must not affect application execution.

---

# Temporary Files

Temporary artifacts belong only in

```text
temp/
```

Nothing inside temp is required for production.

---

# Data Flow

Complete execution flow.

```text
Workflow Input

↓

Provider Loader

↓

Provider Selector

↓

Request Builder

↓

Normalized Request

↓

Provider

↓

Provider Validator

↓

Provider Payload Builder

↓

Authentication

↓

HTTP Request

↓

Provider API

↓

Response Parser

↓

Normalized Response

↓

Status Checker

↓

Workflow Output
```

---

# Error Flow

```text
Validation Error

↓

Normalized Error

↓

Node Error

↓

Workflow Error
```

Provider-specific exceptions should not escape into workflow execution.

---

# Extension Strategy

The architecture is designed for extension, not modification.

Allowed:

* Add providers
* Add documentation
* Add tests
* Add examples
* Add utilities
* Add fixers

Not Allowed:

* Replace workflow
* Replace node architecture
* Replace provider architecture
* Merge responsibilities
* Introduce circular dependencies

---

# AI Development Rules

AI coding assistants must:

* Read `DEVELOPER_GUIDE.md` before generating code.
* Follow every Freeze document.
* Preserve directory structure.
* Preserve naming conventions.
* Avoid architectural redesign.
* Extend existing modules instead of replacing them.
* Generate deterministic and maintainable code.
* Respect module boundaries.

When uncertain, AI should preserve the existing architecture rather than invent a new one.

---

# Source of Truth

When multiple documents overlap, use this priority:

1. Freeze Documents
2. ARCHITECTURE.md
3. DEVELOPER_GUIDE.md
4. API.md
5. INSTALL.md
6. Source Code

---

# Architecture Freeze

The following components are frozen for the MVP lifecycle:

* Project Structure
* Directory Layout
* Workflow
* Node Architecture
* Provider Architecture
* Manifest Architecture
* Script Architecture
* Coding Standards
* Development Workflow
* Release Workflow

Breaking changes require a future major version.

---

# Final Rule

Every pull request, automation, AI-generated change, or manual implementation must answer **YES** to all of the following:

* Does it preserve the architecture?
* Does it respect module boundaries?
* Does it maintain provider isolation?
* Does it avoid circular dependencies?
* Does it follow the workflow?
* Does it comply with the Freeze documents?

If the answer to any question is **No**, the implementation should be revised before being merged.

---

**Version:** v1.0.0
**Status:** Official Technical Architecture Specification
