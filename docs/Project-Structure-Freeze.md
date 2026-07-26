# Project Structure Freeze

**Project:** InvoiceRouter
**Status:** Frozen (MVP)
**Version:** v1.0.0

---

# Purpose

This document defines the official project directory structure for the InvoiceRouter MVP.

The project structure provides a consistent organization for source code, providers, automation scripts, documentation, tests, and project metadata.

All contributors must follow this structure.

---

# Root Structure

```text
InvoiceRouter/

assets/
docs/
examples/
manifest/
nodes/
providers/
shared/
tests/
scripts/

package.json
README.md
LICENSE
.gitignore
```

This is the official project layout for Version **1.0.0**.

---

# Directory Responsibilities

## assets/

Project assets.

Examples:

* Images
* Icons
* Logos
* Screenshots

---

## docs/

Project documentation.

Examples:

* README
* Architecture
* Freeze documents
* Development guides

---

## examples/

Example workflows and usage samples.

Examples:

* n8n workflow examples
* Provider examples
* Sample payloads

---

## manifest/

Configuration-driven project metadata.

Examples:

* architecture.json
* auto-fix.json
* release.json

---

## nodes/

All n8n Community Nodes.

Each node follows the standard node architecture.

---

## providers/

Payment provider implementations.

Each provider follows the official Provider Architecture Freeze.

---

## shared/

Reusable project components.

Examples:

* Types
* Interfaces
* Constants
* Helpers
* Utilities

---

## tests/

Project tests.

Examples:

* Unit tests
* Integration tests
* Provider tests

---

## scripts/

Development automation.

Examples:

* Build
* Test
* Release
* Publish
* Validation
* Auto Fix

---

# Project Principles

The project structure must remain:

* Modular
* Predictable
* Scalable
* Easy to navigate
* Easy to maintain

Every directory should have a single, well-defined purpose.

---

# Naming Convention

Directories use:

* lowercase
* kebab-case when needed

Files use the project's established naming conventions.

Examples:

```text
ProviderLoader.node.ts
ProviderLoader.execute.ts
StripeProvider.ts
StripeParser.ts
build.ps1
release.ps1
```

---

# Ownership

| Directory | Responsibility           |
| --------- | ------------------------ |
| assets    | Static resources         |
| docs      | Documentation            |
| examples  | Example workflows        |
| manifest  | Project configuration    |
| nodes     | n8n nodes                |
| providers | Provider implementations |
| shared    | Shared components        |
| tests     | Test suites              |
| scripts   | Development automation   |

---

# Structure Rules

The project must:

* Keep source code organized by responsibility
* Avoid duplicate functionality
* Reuse shared components whenever possible
* Keep provider code inside `providers`
* Keep node code inside `nodes`
* Keep documentation inside `docs`

---

# Structure Restrictions

The project must not:

* Create arbitrary root folders
* Mix documentation with source code
* Place provider code outside `providers`
* Place automation outside `scripts`
* Duplicate shared utilities across modules

---

# Future Expansion

Future versions may introduce additional subdirectories inside existing folders.

New top-level directories should only be added when they represent a new architectural responsibility and require approval in a future major version.

---

# Freeze Rules

After approval:

* Root directory layout is fixed.
* Directory responsibilities are fixed.
* Naming conventions are fixed.
* Existing directories must not be renamed or repurposed.
* Breaking structural changes require a future major version.

---

# Freeze Status

| Item              | Status   |
| ----------------- | -------- |
| Root Structure    | ✅ Frozen |
| Directory Layout  | ✅ Frozen |
| Responsibilities  | ✅ Frozen |
| Naming Convention | ✅ Frozen |

---

**Version:** v1.0.0
**Status:** Official MVP Project Structure Freeze
