# Changelog

All notable changes to **InvoiceRouter** are documented in this file.

The project follows the principles of **Semantic Versioning (SemVer)**.

Version format:

```text
MAJOR.MINOR.PATCH
```

* **MAJOR** – Incompatible or breaking changes.
* **MINOR** – New features added in a backward-compatible manner.
* **PATCH** – Backward-compatible bug fixes, documentation updates, performance improvements, and maintenance.

---

# Release Policy

Every release should include one or more of the following sections:

* Added
* Changed
* Fixed
* Removed
* Deprecated
* Security
* Documentation

Only user-visible or project-significant changes should be recorded.

---

# [1.0.0] - Initial MVP Release

**Release Status:** Stable

## Added

### Core Architecture

* Established the official InvoiceRouter project architecture.
* Implemented a modular and provider-isolated design.
* Introduced a layered architecture for long-term maintainability.
* Defined the frozen workflow execution pipeline.
* Added architecture manifests for automation.

### Project Structure

* Created the official project directory layout.
* Added standardized folder structure for all project modules.
* Added root project documentation.
* Added development automation structure.
* Added testing infrastructure.
* Added user documentation structure.

### Nodes

Added the following workflow nodes:

* Provider Loader
* Provider Selector
* Request Builder
* Invoice Sender
* Status Checker

### Provider System

Added support for the initial provider architecture.

Initial supported providers:

* Stripe
* LemonSqueezy
* Paddle
* Polar

Each provider follows the standardized provider lifecycle.

### Documentation

Added complete developer documentation, including:

* ARCHITECTURE.md
* API.md
* INSTALL.md
* DEVELOPER_GUIDE.md
* Architecture Freeze documents
* Directory README files

Added complete user documentation structure, including:

* Getting Started
* Installation
* Configuration
* Providers
* Nodes
* Workflows
* Tutorials
* Guides
* FAQ
* Troubleshooting
* Release Notes
* API Reference

### Scripts

Added standardized PowerShell automation scripts for:

* Installation
* Development
* Build
* Testing
* Formatting
* Linting
* Release
* Publishing
* Auto Validation
* Auto Fix

### Manifest

Added project manifest configuration.

Initial manifests:

* architecture.json
* auto-fix.json

---

## Changed

Initial project release.

---

## Fixed

Not applicable for the initial release.

---

## Removed

None.

---

## Deprecated

None.

---

## Security

* Defined architecture protection rules.
* Restricted automatic architectural modifications.
* Added provider isolation requirements.
* Added module boundary enforcement.

---

## Documentation

Initial documentation release containing:

* Developer documentation
* User documentation
* Architecture specifications
* Development workflow
* Release workflow
* Coding standards
* Installation guide
* API reference
* Project structure documentation

---

# Upgrade Notes

This is the initial stable release.

No upgrade or migration steps are required.

---

# Compatibility

| Component     | Version                   |
| ------------- | ------------------------- |
| InvoiceRouter | 1.0.0                     |
| n8n           | Community Node Compatible |
| Node.js       | See INSTALL.md            |
| TypeScript    | Project Supported Version |

---

# Future Releases

Future versions should continue using the following structure:

```markdown
# [1.1.0] - YYYY-MM-DD

## Added

## Changed

## Fixed

## Removed

## Deprecated

## Security

## Documentation
```

Every release should accurately document user-facing changes, architectural updates, bug fixes, and improvements.

---

# Versioning Rules

* Every release must have a unique version number.
* Releases should follow Semantic Versioning.
* Breaking architectural changes require a new **MAJOR** version.
* New backward-compatible features require a new **MINOR** version.
* Bug fixes and documentation improvements require a new **PATCH** version.

---

# References

Additional project information can be found in:

* `ARCHITECTURE.md`
* `docs/CHANGELOG.md`
* `docs/Release-Workflow-Freeze.md`
* `README.md`

---

**Version:** v1.0.0
**Status:** Official Project Changelog
