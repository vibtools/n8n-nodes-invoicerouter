# Manifest

Welcome to the **InvoiceRouter** manifest directory.

The **manifest/** directory contains configuration files that define the project's architecture, automation behavior, validation rules, and metadata.

The manifest layer serves as the **single source of configuration** for automation scripts and developer tooling.

Production code should avoid hardcoded project metadata whenever a manifest entry exists.

---

# Purpose

The manifest system exists to:

* Centralize project configuration.
* Eliminate hardcoded values.
* Support automation.
* Improve maintainability.
* Enable architecture validation.
* Provide metadata for development tools.

The manifest layer defines **what the project is**, while the application code defines **how it works**.

---

# Design Principles

Every manifest file should be:

* Declarative
* Human-readable
* Machine-readable
* Version-controlled
* Easy to validate
* Independent of implementation details

Manifest files describe configuration only. They must not contain executable logic.

---

# Directory Structure

```text
manifest/

README.md

architecture.json
auto-fix.json
```

Additional manifest files may be introduced in future versions while preserving the existing architecture.

---

# Manifest Files

## architecture.json

Defines the official project structure and architecture.

Typical responsibilities include:

* Required directories
* Required files
* Module definitions
* Architecture validation rules
* Project metadata

Automation tools may use this file to verify the integrity of the project structure.

---

## auto-fix.json

Defines supported automatic repair operations.

Typical responsibilities include:

* Supported fixers
* Validation mappings
* Repair policies
* Fix execution order
* Auto-fix configuration

Automation scripts should reference this file instead of relying on hardcoded repair logic.

---

# Future Manifest Files

Future versions may introduce additional manifest files such as:

```text
providers.json
nodes.json
scripts.json
workflows.json
release.json
testing.json
documentation.json
```

New manifest files should extend the existing architecture rather than replace it.

---

# Usage

Manifest files may be used by:

* Development scripts
* Validation tools
* Auto-fix automation
* Build automation
* Release automation
* CI/CD pipelines
* Developer tooling

The application runtime should only read manifest files when configuration is required.

---

# Dependency Rules

The manifest layer should not depend on:

* Providers
* Nodes
* Tests
* Business logic

Instead, other project components may consume manifest data.

Dependency direction:

```text
manifest/

        ▲
        │

scripts/
build/
validation/
tooling/
```

The manifest layer should remain independent and stable.

---

# Naming Convention

Use descriptive file names.

Examples:

```text
architecture.json

auto-fix.json

providers.json

scripts.json
```

Avoid names such as:

```text
config.json

data.json

info.json

temp.json
```

Manifest names should clearly communicate their purpose.

---

# Versioning

Manifest schema changes should follow Semantic Versioning.

* PATCH → Metadata corrections.
* MINOR → New optional fields.
* MAJOR → Breaking schema changes.

Automation should validate manifest versions before using them.

---

# Validation

Every manifest file should be:

* Valid JSON.
* Properly formatted.
* Free from duplicate keys.
* Consistent with the project architecture.
* Compatible with the current project version.

Invalid manifest files should cause validation failures.

---

# Architecture Compliance

The manifest layer must comply with:

* DEVELOPER_GUIDE.md
* Manifest-Architecture-Freeze.md
* Project-Structure-Freeze.md
* Script-Architecture-Freeze.md
* Development-Workflow-Freeze.md

The manifest architecture is part of the project's frozen design and should remain stable throughout the MVP lifecycle.

---

# Contribution Guidelines

Before modifying a manifest:

* Preserve backward compatibility whenever possible.
* Keep configuration declarative.
* Avoid embedding implementation logic.
* Document schema changes.
* Update validation tooling if new fields are introduced.

---

# Source of Truth

When configuration exists in a manifest file, automation and tooling should use the manifest value instead of hardcoded project values.

The manifest layer is the authoritative source for project configuration.

---

# Version

**Version:** v1.0.0

**Status:** Official Manifest Documentation
