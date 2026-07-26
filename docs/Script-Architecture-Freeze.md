# Script Architecture Freeze

**Project:** InvoiceRouter
**Status:** Frozen (MVP)
**Version:** v1.0.0

---

# Purpose

This document defines the official PowerShell automation architecture for the InvoiceRouter MVP.

Every script has a single responsibility and participates in the official development or release workflow.

The script architecture is designed to be modular, maintainable, and configuration-driven.

---

# Design Principles

Every script must:

* Have a single responsibility
* Perform one task only
* Be independently executable
* Be reusable
* Be configuration-driven where applicable
* Produce clear console output
* Return a proper exit code

---

# Script Directory

```text
scripts/

bootstrap.ps1
create-architecture.ps1
auto-validator.ps1
auto-fix.ps1
doctor.ps1

install.ps1
clean.ps1
format.ps1
lint.ps1
build.ps1
test.ps1
dev.ps1

release.ps1
publish.ps1

fixers/
```

---

# Script Responsibilities

## bootstrap.ps1

Purpose

* Entry point
* Start the development workflow
* Orchestrate required scripts

---

## create-architecture.ps1

Purpose

* Generate project folders
* Generate project files
* Apply the official architecture

---

## auto-validator.ps1

Purpose

* Validate project structure
* Validate required files
* Validate project consistency

---

## auto-fix.ps1

Purpose

* Detect supported project issues
* Execute registered fixers
* Produce repair summary

---

## doctor.ps1

Purpose

* Run project diagnostics
* Verify project health
* Report issues

---

## install.ps1

Purpose

* Install project dependencies

---

## clean.ps1

Purpose

* Remove temporary and generated files

---

## format.ps1

Purpose

* Format source code

---

## lint.ps1

Purpose

* Execute static analysis

---

## build.ps1

Purpose

* Compile the project

---

## test.ps1

Purpose

* Execute project tests

---

## dev.ps1

Purpose

* Start the development environment

---

## release.ps1

Purpose

* Prepare release artifacts

---

## publish.ps1

Purpose

* Publish the official release

---

# Auto Fix Architecture

```text
scripts/

auto-fix.ps1

fixers/

DependencyFixer.ps1
JsonFixer.ps1
ManifestFixer.ps1
PackageFixer.ps1
TypeScriptFixer.ps1
ESLintFixer.ps1
PrettierFixer.ps1
N8NFixer.ps1
BuildFixer.ps1
VerifyFixer.ps1
```

Each fixer is responsible for exactly one repair domain.

---

# Execution Model

```text
bootstrap
      │
      ▼
Development Scripts
      │
      ▼
Auto Fix (Optional)
      │
      ▼
Release Scripts
```

---

# Common Script Standards

Every script should:

* Use `$ErrorActionPreference = "Stop"`
* Read configuration from the `manifest/` directory when applicable
* Display a clear execution summary
* Return `exit 0` on success
* Return `exit 1` on failure
* Avoid modifying responsibilities assigned to other scripts

---

# Script Rules

Scripts must:

* Have one responsibility
* Be modular
* Be readable
* Be deterministic
* Be safe to execute multiple times where appropriate

---

# Script Restrictions

Scripts must not:

* Duplicate another script's responsibility
* Hardcode project architecture
* Modify unrelated project components
* Depend directly on another script's internal implementation

---

# Future Expansion

New scripts may be added in future versions only if they represent a new responsibility.

Existing script responsibilities must remain unchanged.

---

# Freeze Rules

After approval:

* Script list is fixed.
* Script responsibilities are fixed.
* Execution responsibilities are fixed.
* Auto Fix architecture is fixed.
* Breaking changes require a future major version.

---

# Freeze Status

| Item                  | Status   |
| --------------------- | -------- |
| Script List           | ✅ Frozen |
| Responsibilities      | ✅ Frozen |
| Auto Fix Architecture | ✅ Frozen |
| Execution Model       | ✅ Frozen |

---

**Version:** v1.0.0
**Status:** Official MVP Script Architecture Freeze
