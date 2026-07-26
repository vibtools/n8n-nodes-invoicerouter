# User Documentation

Welcome to the **InvoiceRouter User Documentation**.

This directory contains the official end-user documentation for InvoiceRouter.

Unlike the **docs/** directory, which is intended for developers and contributors, this documentation is written for users who want to install, configure, and use InvoiceRouter in production.

The contents of this directory are designed to be published directly as a documentation website.

---

# Purpose

The User Documentation exists to:

* Help users get started quickly.
* Explain how to install and configure InvoiceRouter.
* Document every supported feature.
* Provide practical examples and tutorials.
* Offer troubleshooting guidance.
* Serve as the official product documentation.

This documentation should focus on **using** the project, not **developing** it.

---

# Target Audience

This documentation is intended for:

* End Users
* n8n Users
* System Administrators
* DevOps Engineers
* Self-hosting Users
* Payment System Integrators

Developer-specific implementation details belong in the project's **docs/** directory.

---

# Directory Structure

```text
user-docs/

README.md
index.md

assets/

getting-started/
installation/
configuration/
providers/
nodes/
workflows/
examples/
tutorials/
guides/
faq/
troubleshooting/
release-notes/
api-reference/
```

Every directory should focus on one documentation topic.

---

# Documentation Categories

| Directory            | Purpose                               |
| -------------------- | ------------------------------------- |
| **getting-started/** | First-time setup and introduction     |
| **installation/**    | Installation guides                   |
| **configuration/**   | Configuration and credentials         |
| **providers/**       | Payment provider setup guides         |
| **nodes/**           | Node usage documentation              |
| **workflows/**       | Workflow examples                     |
| **examples/**        | Practical usage examples              |
| **tutorials/**       | Step-by-step tutorials                |
| **guides/**          | Best practices and advanced topics    |
| **faq/**             | Frequently asked questions            |
| **troubleshooting/** | Common problems and solutions         |
| **release-notes/**   | User-facing release history           |
| **api-reference/**   | Public API reference (if applicable)  |
| **assets/**          | Images, diagrams, screenshots, videos |

---

# Documentation Principles

Every document should be:

* Clear
* Beginner-friendly
* Accurate
* Up-to-date
* Easy to navigate
* Easy to search

The goal is to help users complete tasks successfully with minimal effort.

---

# Writing Guidelines

Documentation should:

* Explain **what** to do.
* Explain **why** it is needed.
* Show **how** to do it.
* Include screenshots when useful.
* Include examples whenever possible.
* Avoid unnecessary implementation details.

User documentation should not expose internal architecture unless required for understanding.

---

# Documentation Workflow

The documentation lifecycle follows this process:

```text
New Feature

↓

Implementation

↓

Testing

↓

User Documentation

↓

Review

↓

CI/CD Build

↓

Documentation Website

↓

Publish
```

Every user-facing feature should include corresponding documentation before release.

---

# CI/CD Integration

The **user-docs/** directory is designed to support automated documentation publishing.

Typical pipeline:

```text
Git Commit

↓

GitHub Actions / CI

↓

Validate Markdown

↓

Generate Documentation Site

↓

Build Static Website

↓

Deploy
```

Documentation should always remain compatible with the chosen documentation framework.

---

# Supported Documentation

This directory may contain:

* Markdown documentation
* Images
* Diagrams
* Screenshots
* Embedded videos
* Code examples
* Configuration examples

All documentation assets should remain organized within the project structure.

---

# Versioning

User documentation should match the corresponding software release.

Whenever a new version introduces:

* New features
* UI changes
* Configuration changes
* Workflow changes
* Provider changes

the relevant documentation should be updated before publishing.

---

# Contribution Guidelines

When contributing documentation:

* Write for end users.
* Keep instructions simple.
* Verify all examples.
* Update screenshots when necessary.
* Avoid duplicate content.
* Keep navigation consistent.

Every new user-facing feature should include documentation.

---

# Relationship to Developer Documentation

InvoiceRouter maintains two separate documentation systems.

| Directory      | Audience                              |
| -------------- | ------------------------------------- |
| **docs/**      | Developers, contributors, maintainers |
| **user-docs/** | End users, administrators, customers  |

Developer documentation explains **how InvoiceRouter is built**.

User documentation explains **how InvoiceRouter is used**.

---

# Future Documentation Website

This directory is intentionally structured to support future static documentation websites, including:

* Docusaurus
* MkDocs
* Astro Starlight
* Mintlify
* Other Markdown-based documentation systems

The directory layout should remain framework-independent so it can be adapted without reorganizing the content.

---

# Version

**Documentation Version:** v1.0.0

**Status:** Official User Documentation Index
