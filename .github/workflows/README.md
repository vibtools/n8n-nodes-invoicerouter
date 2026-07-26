# GitHub Workflows

The **.github/workflows/** directory contains all GitHub Actions workflows used to automate the development lifecycle of the InvoiceRouter project.

Each workflow is designed to perform **one well-defined responsibility** and follows the project's architecture and automation standards.

---

# Purpose

The workflows in this directory automate common development tasks, including:

* Project bootstrapping
* Dependency installation
* Architecture validation
* Code formatting
* Linting
* Building
* Testing
* Documentation validation
* Release automation
* Package publishing

Automation helps ensure that every commit and release follows the same repeatable process.

---

# Directory Structure

```text
.github/
└── workflows/
    ├── README.md
    ├── 01-bootstrap.yml
    ├── 02-build.yml
    ├── 03-docs.yml
    └── 04-release.yml
```

Additional workflows may be introduced in future releases without changing the responsibilities of existing workflows.

---

# Workflow Overview

| Workflow             | Responsibility                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **01-bootstrap.yml** | Prepare the project, install dependencies, validate architecture, and generate required project skeletons. |
| **02-build.yml**     | Build the project, run formatting, linting, type checking, and automated tests.                            |
| **03-docs.yml**      | Validate documentation, build documentation assets, and prepare documentation for publishing.              |
| **04-release.yml**   | Build release artifacts, create GitHub Releases, and publish production packages.                          |

Each workflow should remain focused on its own lifecycle stage.

---

# Workflow Lifecycle

The standard CI/CD execution flow is:

```text
Developer Push

↓

01-bootstrap.yml

↓

02-build.yml

↓

03-docs.yml

↓

04-release.yml
```

Each stage depends on the successful completion of the previous stage.

---

# 01-bootstrap.yml

Primary responsibilities:

* Checkout repository
* Setup Node.js
* Restore dependency cache
* Install project dependencies
* Validate `manifest/architecture.json`
* Validate `manifest/auto-fix.json`
* Verify required folders
* Generate missing project skeletons
* Generate missing node skeletons
* Generate missing provider skeletons
* Produce bootstrap reports

---

# 02-build.yml

Primary responsibilities:

* Restore dependencies
* Run formatting
* Execute ESLint
* Perform TypeScript validation
* Build the project
* Run automated tests
* Generate build reports

---

# 03-docs.yml

Primary responsibilities:

* Validate Markdown files
* Validate documentation structure
* Verify documentation links
* Build documentation site
* Prepare documentation artifacts
* Deploy documentation (future)

---

# 04-release.yml

Primary responsibilities:

* Validate release readiness
* Build production package
* Generate release artifacts
* Create GitHub Release
* Publish npm package
* Archive build outputs

---

# Workflow Design Principles

Every workflow should be:

* Independent
* Predictable
* Deterministic
* Repeatable
* Idempotent where possible
* Easy to debug
* Easy to maintain

Each workflow should have one primary responsibility.

---

# Naming Convention

Workflow files use numeric prefixes to indicate execution order.

Example:

```text
01-bootstrap.yml
02-build.yml
03-docs.yml
04-release.yml
```

This naming convention keeps workflow execution easy to understand and maintain.

---

# Error Handling

Each workflow should:

* Stop on critical failures.
* Produce meaningful logs.
* Upload reports when appropriate.
* Return consistent exit codes.
* Avoid hiding errors.

Failed workflows should provide enough information to identify the root cause quickly.

---

# Logging and Artifacts

Workflows may generate:

* Validation reports
* Build reports
* Test reports
* Documentation reports
* Release artifacts

Generated outputs should be uploaded as GitHub Actions artifacts when appropriate.

---

# Architecture Compliance

Workflows must respect the project's frozen architecture.

Workflows must **not**:

* Modify project architecture.
* Rename protected directories.
* Rename protected files.
* Replace workflow stages.
* Generate application business logic.
* Bypass architecture validation.

Automation should enforce project standards rather than redefine them.

---

# AI Development Guidelines

AI assistants modifying workflows should:

* Read `ARCHITECTURE.md` before making changes.
* Follow all Freeze documents.
* Preserve workflow responsibilities.
* Generate deterministic GitHub Actions.
* Keep workflows modular and readable.
* Avoid unnecessary complexity.
* Maintain compatibility with future CI/CD expansion.

---

# Future Workflows

Future versions may introduce additional workflows, including:

* `05-security.yml`
* `06-dependency-update.yml`
* `07-nightly.yml`
* `08-performance.yml`
* `09-codeql.yml`

New workflows should extend the automation pipeline without changing the responsibilities of existing workflows.

---

# Related Documentation

* `ARCHITECTURE.md`
* `manifest/architecture.json`
* `manifest/auto-fix.json`
* `.github/README.md`
* `docs/Development-Workflow-Freeze.md`
* `docs/Release-Workflow-Freeze.md`

---

**Version:** v1.0.0
**Status:** Official GitHub Actions Workflow Documentation
