# InvoiceRouter Documentation

Welcome to the official documentation for **InvoiceRouter**.

This directory contains all technical documentation, architecture specifications, development guidelines, installation instructions, and project governance documents.

These documents collectively define how the project is designed, developed, maintained, and extended.

---

# Documentation Overview

The documentation is organized into four categories:

* Project Documentation
* Developer Documentation
* Architecture Freeze Documents
* Project History

---

# Project Documentation

| Document               | Purpose                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API.md**             | Defines the unified API architecture, request lifecycle, provider interfaces, response normalization, and integration standards.                              |
| **INSTALL.md**         | Installation instructions, project setup, development environment, build process, testing, validation, and release workflow.                                  |
| **DEVELOPER_GUIDE.md** | Official development rules and scope lock for contributors, maintainers, and AI coding assistants. Defines what is allowed and prohibited during development. |
| **CHANGELOG.md**       | Records all released versions, notable changes, additions, fixes, and release history.                                                                        |

---

# Architecture Freeze Documents

The following documents define the **official MVP architecture**.

These documents should be considered **architecture contracts** rather than optional recommendations.

| Document                            | Purpose                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------- |
| **Feature-Freeze.md**               | Defines the approved MVP feature scope.                                 |
| **Project-Structure-Freeze.md**     | Defines the official folder and file organization.                      |
| **Node-Freeze.md**                  | Defines the architecture of every n8n node.                             |
| **Workflow-Freeze.md**              | Defines the official execution workflow.                                |
| **Provider-Architecture-Freeze.md** | Defines the provider implementation architecture and responsibilities.  |
| **Script-Architecture-Freeze.md**   | Defines the PowerShell automation architecture.                         |
| **Manifest-Architecture-Freeze.md** | Defines manifest configuration responsibilities and usage.              |
| **Development-Workflow-Freeze.md**  | Defines the official development lifecycle.                             |
| **Release-Workflow-Freeze.md**      | Defines the release and publishing workflow.                            |
| **Coding-Standards-Freeze.md**      | Defines naming conventions, coding standards, and implementation rules. |
| **Versioning-Freeze.md**            | Defines Semantic Versioning policies and release strategy.              |
| **Documentation-Freeze.md**         | Defines documentation standards and maintenance requirements.           |
| **Contributing-Freeze.md**          | Defines contribution policies and repository collaboration rules.       |

---

# Reading Order

New contributors should read the documentation in the following order:

1. README.md (Project Root)
2. INSTALL.md
3. DEVELOPER_GUIDE.md
4. API.md
5. Feature-Freeze.md
6. Project-Structure-Freeze.md
7. Workflow-Freeze.md
8. Provider-Architecture-Freeze.md
9. Node-Freeze.md
10. Coding-Standards-Freeze.md
11. Development-Workflow-Freeze.md
12. Release-Workflow-Freeze.md
13. Manifest-Architecture-Freeze.md
14. Documentation-Freeze.md
15. Versioning-Freeze.md
16. Contributing-Freeze.md
17. CHANGELOG.md

---

# Architecture Status

**Current Status:** Architecture Locked (MVP)

The following components are frozen:

* Project Structure
* Folder Organization
* Node Architecture
* Workflow
* Provider Architecture
* Script Architecture
* Manifest Architecture
* Coding Standards
* Development Workflow
* Release Workflow

Breaking changes to these components are not permitted during the MVP lifecycle.

---

# Documentation Principles

All documentation should be:

* Accurate
* Versioned
* Consistent
* Easy to navigate
* Easy to maintain
* Updated alongside implementation

Documentation is considered part of the project source and should remain synchronized with the codebase.

---

# Developer Responsibilities

Before implementing any feature, contributors should:

* Read the relevant documentation.
* Follow all Freeze documents.
* Respect the locked architecture.
* Avoid introducing breaking changes.
* Keep documentation synchronized with implementation.

---

# AI Assistant Usage

When using AI coding assistants (Claude Code, GitHub Copilot, ChatGPT, Cursor, etc.):

* Use **DEVELOPER_GUIDE.md** as the primary development instruction.
* Follow all Freeze documents before generating code.
* Preserve the existing architecture.
* Avoid creating alternative implementations that conflict with the documented design.

---

# Source of Truth

When multiple documents overlap, use the following priority:

1. Freeze Documents
2. DEVELOPER_GUIDE.md
3. API.md
4. INSTALL.md
5. CHANGELOG.md
6. Root README.md

---

# Version

**Documentation Version:** v1.0.0

**Status:** Official Documentation Index
