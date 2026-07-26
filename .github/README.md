# GitHub Configuration

The **.github/** directory contains all GitHub-specific configuration files used by the InvoiceRouter project.

This directory is responsible for GitHub automation, Continuous Integration (CI), Continuous Deployment (CD), issue management, pull request templates, repository configuration, and future GitHub workflows.

The contents of this directory should remain independent of the application's business logic.

---

# Purpose

The `.github/` directory exists to:

* Store GitHub Actions workflows.
* Automate project validation and builds.
* Support automated testing.
* Prepare releases.
* Publish project artifacts.
* Improve repository maintenance.
* Standardize GitHub collaboration.

---

# Directory Structure

```text
.github/

README.md

workflows/
```

Additional GitHub configuration files may be added in future releases without changing the project architecture.

Examples include:

```text
.github/

workflows/

ISSUE_TEMPLATE/
PULL_REQUEST_TEMPLATE.md
CODEOWNERS
FUNDING.yml
dependabot.yml
release.yml
```

---

# Responsibilities

The `.github/` directory is responsible for:

* GitHub Actions
* Repository automation
* CI/CD pipelines
* Pull request validation
* Release automation
* Issue templates
* Repository metadata
* GitHub-specific configuration

The application source code must never be placed inside this directory.

---

# GitHub Actions

All automation workflows are stored in:

```text
.github/workflows/
```

Each workflow performs one clearly defined responsibility.

Current workflow plan:

| Workflow         | Purpose                                 |
| ---------------- | --------------------------------------- |
| 01-bootstrap.yml | Project bootstrap and validation        |
| 02-build.yml     | Build, lint, and test                   |
| 03-docs.yml      | Documentation validation and publishing |
| 04-release.yml   | Release and package publishing          |

Future workflows may be added while preserving the existing numbering and responsibilities.

---

# CI/CD Philosophy

InvoiceRouter uses GitHub Actions to automate repetitive development tasks.

Typical workflow:

```text
Developer Push

↓

GitHub Actions

↓

Checkout Repository

↓

Install Dependencies

↓

Validate Architecture

↓

Build Project

↓

Run Tests

↓

Generate Reports

↓

Release (when applicable)
```

Automation should improve consistency without changing project behavior.

---

# Architecture Rules

GitHub workflows must respect the project's frozen architecture.

Workflows must **not**:

* Modify project architecture.
* Rename protected files.
* Rename protected directories.
* Replace providers.
* Replace nodes.
* Change workflow order.
* Generate business logic.

Automation should validate and extend the project—not redesign it.

---

# AI Guidelines

AI assistants working inside `.github/` should:

* Read `ARCHITECTURE.md`.
* Follow all Freeze documents.
* Preserve workflow responsibilities.
* Keep workflows deterministic.
* Avoid introducing unnecessary complexity.
* Generate maintainable GitHub Actions.

---

# Related Documentation

* `ARCHITECTURE.md`
* `manifest/architecture.json`
* `manifest/auto-fix.json`
* `scripts/README.md`
* `.github/workflows/README.md`

---

**Version:** v1.0.0
**Status:** Official GitHub Configuration Documentation
