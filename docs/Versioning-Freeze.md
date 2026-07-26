# Versioning Freeze

**Project:** InvoiceRouter
**Status:** Frozen (MVP)
**Version:** v1.0.0

---

# Purpose

This document defines the official versioning policy for the InvoiceRouter project.

Every project release must follow the same versioning rules to ensure consistency, predictability, and compatibility.

Version numbers communicate the scope and impact of changes.

---

# Version Format

InvoiceRouter follows **Semantic Versioning (SemVer)**.

```text
MAJOR.MINOR.PATCH
```

Example:

```text
1.0.0
```

---

# Version Components

## MAJOR

Increment the **MAJOR** version when introducing incompatible or breaking changes.

Examples:

* Architecture redesign
* Breaking API changes
* Breaking node changes
* Breaking provider changes
* Major project restructuring

Example:

```text
1.0.0
↓

2.0.0
```

---

## MINOR

Increment the **MINOR** version when adding new functionality without breaking existing behavior.

Examples:

* New provider
* New node
* New workflow capability
* New automation script
* New documentation section

Example:

```text
1.0.0
↓

1.1.0
```

---

## PATCH

Increment the **PATCH** version for backward-compatible improvements.

Examples:

* Bug fixes
* Documentation updates
* Performance improvements
* Refactoring
* Test improvements

Example:

```text
1.0.0
↓

1.0.1
```

---

# Official Release Types

| Type            | Example |
| --------------- | ------- |
| Initial Release | 1.0.0   |
| Bug Fix         | 1.0.1   |
| Feature Update  | 1.1.0   |
| Major Release   | 2.0.0   |

---

# MVP Version

The official MVP release is:

```text
v1.0.0
```

This version establishes the frozen architecture and workflow.

---

# Files Updated Per Release

Each release should update the project version in:

* README.md
* package.json
* package-lock.json (if applicable)
* CHANGELOG.md
* Release Notes
* Git Tag
* GitHub Release

---

# Release Documentation

Every release should include:

* Version number
* Release date
* Summary
* New features
* Improvements
* Bug fixes
* Known limitations

---

# Version Compatibility

| Change                  | Version Update |
| ----------------------- | -------------- |
| Bug Fix                 | PATCH          |
| Documentation Update    | PATCH          |
| Performance Improvement | PATCH          |
| New Provider            | MINOR          |
| New Node                | MINOR          |
| New Workflow            | MINOR          |
| Breaking Architecture   | MAJOR          |
| Breaking API            | MAJOR          |

---

# Git Tag Convention

Every official release should be tagged.

Examples:

```text
v1.0.0
v1.0.1
v1.1.0
v2.0.0
```

---

# Freeze Rules

After approval:

* Semantic Versioning is mandatory.
* Version update rules are fixed.
* Release numbering is fixed.
* Breaking changes require a MAJOR version.
* New features require a MINOR version.
* Bug fixes require a PATCH version.

---

# Freeze Status

| Item                | Status   |
| ------------------- | -------- |
| Version Format      | ✅ Frozen |
| Semantic Versioning | ✅ Frozen |
| Release Rules       | ✅ Frozen |
| Compatibility Rules | ✅ Frozen |

---

**Version:** v1.0.0
**Status:** Official MVP Versioning Freeze
