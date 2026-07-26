# Feature Freeze

**Project:** InvoiceRouter
**Status:** Frozen (MVP)
**Version:** v1.0.0

---

# Purpose

This document defines the official **Minimum Viable Product (MVP)** feature set for InvoiceRouter.

Only the features listed in this document are considered part of the MVP release.

Any new feature request after this point must be scheduled for a future version and must not change the MVP architecture.

---

# MVP Scope

InvoiceRouter is an **n8n Community Node** that provides a unified invoice workflow across multiple payment providers.

The MVP focuses on:

* Unified provider architecture
* Unified invoice workflow
* Consistent node design
* Provider abstraction
* Production-ready project structure
* Automated development workflow

---

# Included Features

## Core Workflow

* Provider loading
* Provider selection
* Request generation
* Invoice submission
* Invoice status retrieval
* Normalized response output

---

## Multi-Provider Support

The project supports a pluggable provider architecture.

### MVP Providers

* Stripe
* LemonSqueezy
* Paddle
* Polar

---

## Node System

The project contains dedicated nodes for:

* Provider Loader
* Provider Selector
* Request Builder
* Invoice Sender
* Status Checker

---

## Shared Components

Shared project components include:

* Types
* Constants
* Helpers
* Common utilities
* Shared interfaces

---

## Automation Toolkit

Included PowerShell automation:

* bootstrap.ps1
* create-architecture.ps1
* auto-validator.ps1
* auto-fix.ps1
* doctor.ps1
* install.ps1
* clean.ps1
* format.ps1
* lint.ps1
* build.ps1
* test.ps1
* dev.ps1
* release.ps1
* publish.ps1

---

## Manifest System

The project is configuration-driven.

Manifest files define:

* Architecture
* Release configuration
* Auto-fix configuration
* Project metadata

---

# Excluded From MVP

The following items are **not** part of Version 1.0.0.

* Additional payment providers
* Subscription management
* Customer management
* Refund management
* Webhook management
* Dashboard UI
* Analytics
* CLI application
* AI-assisted workflow generation
* Provider marketplace
* Cloud synchronization

---

# Freeze Rules

After this document is approved:

* No new MVP features may be added.
* Existing MVP features may only receive bug fixes.
* Architecture changes are not allowed.
* Breaking changes are not allowed.
* Large refactoring is not allowed.

---

# Future Versions

Future releases may introduce:

* New providers
* Additional nodes
* New workflow types
* Performance improvements
* Testing improvements
* Documentation improvements

These additions must not modify the frozen MVP architecture.

---

# Freeze Status

| Item              | Status   |
| ----------------- | -------- |
| Project Scope     | ✅ Frozen |
| MVP Features      | ✅ Frozen |
| Development Scope | ✅ Frozen |
| Release Scope     | ✅ Frozen |

---

**Version:** v1.0.0
**Status:** Official MVP Feature Freeze
