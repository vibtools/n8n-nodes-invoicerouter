# Manifest Architecture Freeze

**Project:** InvoiceRouter
**Status:** Frozen (MVP)
**Version:** v1.0.0

---

# Purpose

This document defines the official manifest architecture for the InvoiceRouter MVP.

The project is **configuration-driven**. Project automation, validation, release, and repair workflows should read from manifest files whenever applicable instead of relying on hardcoded values.

---

# Design Principles

The manifest system should be:

* Configuration-driven
* Modular
* Human-readable
* Version-controlled
* Easy to extend
* Independent from implementation details

---

# Manifest Directory

```text
manifest/

architecture.json
auto-fix.json
```

Additional manifest files may be introduced in future versions without changing the overall manifest architecture.

---

# Manifest Responsibilities

## architecture.json

Purpose

* Define the official project structure
* Define required directories
* Define required files
* Define architecture validation rules

Used by:

* create-architecture.ps1
* auto-validator.ps1

---

## auto-fix.json

Purpose

* Configure Auto Fix behavior
* Configure repair modules
* Configure validation options
* Configure build verification

Used by:

* auto-fix.ps1
* DependencyFixer.ps1
* JsonFixer.ps1
* ManifestFixer.ps1
* PackageFixer.ps1
* TypeScriptFixer.ps1
* ESLintFixer.ps1
* PrettierFixer.ps1
* N8NFixer.ps1
* BuildFixer.ps1
* VerifyFixer.ps1

---

# Configuration Philosophy

Manifest files should describe:

* Project metadata
* Project architecture
* Validation rules
* Script configuration
* Feature configuration

Manifest files should not contain implementation logic.

---

# Script Integration

The following scripts are expected to consume manifest configuration where applicable.

| Script                  | Manifest          |
| ----------------------- | ----------------- |
| create-architecture.ps1 | architecture.json |
| auto-validator.ps1      | architecture.json |
| auto-fix.ps1            | auto-fix.json     |
| Fixers                  | auto-fix.json     |

---

# Project Flow

```text
Manifest

      │

      ▼

Automation Scripts

      │

      ▼

Validation

      │

      ▼

Project Actions
```

Configuration drives automation.

Automation drives execution.

---

# Manifest Rules

Every manifest should:

* Be valid JSON
* Be UTF-8 encoded
* Use consistent formatting
* Be version controlled
* Be easy to read
* Be deterministic

---

# Manifest Restrictions

Manifest files must not:

* Contain executable code
* Duplicate source code
* Store business logic
* Store temporary data
* Depend on runtime-generated values

---

# Future Expansion

Future versions may introduce additional manifest files, for example:

* release.json
* providers.json
* nodes.json
* scripts.json
* documentation.json
* project.json

New manifest files must integrate with the existing configuration-driven architecture.

---

# Freeze Rules

After approval:

* Manifest architecture is fixed.
* Existing manifest responsibilities are fixed.
* Automation must prefer manifest configuration over hardcoded values.
* Breaking manifest changes require a future major version.

---

# Freeze Status

| Item                | Status   |
| ------------------- | -------- |
| Manifest Structure  | ✅ Frozen |
| Configuration Model | ✅ Frozen |
| Script Integration  | ✅ Frozen |
| Responsibilities    | ✅ Frozen |

---

**Version:** v1.0.0
**Status:** Official MVP Manifest Architecture Freeze
