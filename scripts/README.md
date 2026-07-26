# Scripts

Welcome to the **InvoiceRouter** automation directory.

The **scripts/** directory contains all PowerShell automation used to develop, validate, build, test, maintain, and release the project.

Every script is designed with a **single responsibility** and follows the project's frozen architecture.

---

# Purpose

The automation system exists to:

* Simplify development
* Standardize workflows
* Reduce manual work
* Improve consistency
* Validate project integrity
* Support repeatable releases

Scripts should automate project tasks without changing the project's architecture.

---

# Design Principles

Every script should be:

* Modular
* Predictable
* Idempotent
* Safe to run multiple times
* Easy to understand
* Easy to maintain

Scripts should automate work—not make architectural decisions.

---

# Directory Structure

```text
scripts/

README.md

bootstrap.ps1
create-architecture.ps1

install.ps1
clean.ps1
format.ps1
lint.ps1
build.ps1
test.ps1
dev.ps1

doctor.ps1
auto-validator.ps1
auto-fix.ps1

release.ps1
publish.ps1

fixers/
```

---

# Script Responsibilities

| Script                      | Responsibility                                               |
| --------------------------- | ------------------------------------------------------------ |
| **bootstrap.ps1**           | Prepare the local development environment.                   |
| **create-architecture.ps1** | Generate the official project folder and file structure.     |
| **install.ps1**             | Install project dependencies.                                |
| **clean.ps1**               | Remove generated files and temporary artifacts.              |
| **format.ps1**              | Format project source code.                                  |
| **lint.ps1**                | Execute static code analysis.                                |
| **build.ps1**               | Compile the project.                                         |
| **test.ps1**                | Execute automated tests.                                     |
| **dev.ps1**                 | Start the local development workflow.                        |
| **doctor.ps1**              | Diagnose project configuration and environment issues.       |
| **auto-validator.ps1**      | Validate project structure, architecture, and configuration. |
| **auto-fix.ps1**            | Automatically repair supported project issues.               |
| **release.ps1**             | Prepare an official release package.                         |
| **publish.ps1**             | Publish a validated release.                                 |

---

# Fixers

The **fixers/** directory contains modular repair scripts used by **auto-fix.ps1**.

Example structure:

```text
scripts/

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

Each fixer should repair one specific class of problems.

---

# Development Workflow

Recommended execution order:

```text
Install

↓

Format

↓

Lint

↓

Build

↓

Test

↓

Development

↓

Release

↓

Publish
```

---

# Script Rules

Every script should:

* Perform one responsibility.
* Return appropriate exit codes.
* Print meaningful progress messages.
* Stop on unrecoverable errors.
* Avoid modifying unrelated files.
* Produce deterministic results.

---

# Error Handling

Scripts should:

* Detect failures early.
* Report clear error messages.
* Exit with a non-zero status on failure.
* Avoid leaving partial changes whenever possible.

---

# Naming Convention

Use descriptive script names.

Examples:

```text
build.ps1
release.ps1
doctor.ps1
auto-validator.ps1
```

Avoid generic names such as:

```text
script.ps1
run.ps1
tool.ps1
temp.ps1
```

---

# Dependency Rules

Scripts may depend on:

* Project configuration
* Manifest files
* Build tools
* Development tooling

Scripts should **not** depend on:

* Provider implementations
* Business logic
* Runtime workflow behavior

Automation and application logic must remain separate.

---

# Architecture Compliance

All automation must comply with:

* DEVELOPER_GUIDE.md
* Script-Architecture-Freeze.md
* Development-Workflow-Freeze.md
* Release-Workflow-Freeze.md
* Manifest-Architecture-Freeze.md

Scripts must preserve the project's frozen architecture.

---

# Contribution Guidelines

When adding a new script:

* Verify that an existing script cannot perform the task.
* Assign one clear responsibility.
* Follow the established naming convention.
* Document the script if it becomes part of the official workflow.
* Update this README when new top-level scripts are introduced.

---

# Future Expansion

Future automation may include:

* CI helper scripts
* Documentation generation
* Package verification
* Release validation
* Benchmark automation
* Code quality reporting

All new automation should integrate with the existing script architecture rather than replacing it.

---

# Version

**Version:** v1.0.0

**Status:** Official Script Automation Documentation
