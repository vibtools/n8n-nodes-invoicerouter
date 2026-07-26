# Fixers

The **fixers/** directory contains automated repair modules used by InvoiceRouter development, validation, and CI/CD workflows.

Each fixer is responsible for detecting and correcting one specific category of project issues while preserving the project's frozen architecture.

---

# Purpose

The fixers are designed to:

* Detect common project issues.
* Apply safe and repeatable corrections.
* Reduce manual maintenance.
* Improve development consistency.
* Support CI/CD automation.
* Keep the project compliant with the Architecture Freeze documents.

Each fixer should perform **one well-defined responsibility**.

---

# Directory Structure

```text
scripts/
└── fixers/
    ├── README.md
    ├── DependencyFixer.ps1
    ├── JsonFixer.ps1
    ├── ManifestFixer.ps1
    ├── PackageFixer.ps1
    ├── TypeScriptFixer.ps1
    ├── ESLintFixer.ps1
    ├── PrettierFixer.ps1
    ├── N8NFixer.ps1
    ├── BuildFixer.ps1
    └── VerifyFixer.ps1
```

Additional fixers may be added in future releases without modifying the existing architecture.

---

# Available Fixers

| Fixer           | Responsibility                                    |
| --------------- | ------------------------------------------------- |
| DependencyFixer | Install, repair, or validate project dependencies |
| JsonFixer       | Validate and normalize JSON files                 |
| ManifestFixer   | Validate files inside the `manifest/` directory   |
| PackageFixer    | Validate and repair `package.json` configuration  |
| TypeScriptFixer | Detect and fix TypeScript configuration issues    |
| ESLintFixer     | Execute linting fixes                             |
| PrettierFixer   | Apply formatting rules                            |
| N8NFixer        | Validate n8n node conventions and metadata        |
| BuildFixer      | Repair common build-related issues                |
| VerifyFixer     | Run final verification after all fixers complete  |

---

# Execution Order

Fixers should execute in the following order:

```text
DependencyFixer
        ↓
JsonFixer
        ↓
ManifestFixer
        ↓
PackageFixer
        ↓
TypeScriptFixer
        ↓
ESLintFixer
        ↓
PrettierFixer
        ↓
N8NFixer
        ↓
BuildFixer
        ↓
VerifyFixer
```

This order minimizes cascading errors and ensures that validation occurs after repairs.

---

# Design Principles

Every fixer should:

* Have a single responsibility.
* Be deterministic.
* Be repeatable.
* Be idempotent whenever possible.
* Produce consistent output.
* Generate useful logs.
* Fail safely.
* Respect project boundaries.

A fixer should never depend on side effects produced by unrelated fixers.

---

# Responsibilities

A fixer **may**:

* Repair configuration files.
* Validate project structure.
* Restore missing metadata.
* Normalize formatting.
* Verify required files.
* Repair development configuration.
* Produce validation reports.

A fixer **must not**:

* Redesign the project.
* Rename protected files.
* Rename protected directories.
* Delete project source code.
* Modify business logic.
* Change workflow behavior.
* Change provider implementations.
* Change node implementations.
* Bypass architecture validation.

---

# Input

A fixer may inspect:

* Project directories
* Source files
* Configuration files
* Manifest files
* Documentation
* Build outputs
* Dependency metadata

---

# Output

Each fixer should return a structured result similar to:

```json
{
  "fixer": "JsonFixer",
  "status": "Success",
  "filesChecked": 18,
  "filesModified": 2,
  "warnings": 0,
  "errors": 0,
  "durationMs": 146
}
```

This format supports logging, reporting, and future automation.

---

# Logging

Fixers should write execution details to the automation log directory.

Typical information includes:

* Start time
* End time
* Files scanned
* Files modified
* Warnings
* Errors
* Execution duration
* Final status

Logs should never replace source files.

---

# Error Handling

A fixer should:

1. Validate prerequisites.
2. Execute its task.
3. Report warnings.
4. Report failures.
5. Return a consistent exit status.

Unexpected failures should stop only the affected fixer unless project policy specifies otherwise.

---

# CI/CD Integration

Fixers are intended to run during automated workflows such as:

```text
Developer
      ↓
Validation
      ↓
Auto Fix
      ↓
Build
      ↓
Test
      ↓
Verification
      ↓
Release
```

They may also be executed manually during local development.

---

# AI Development Guidelines

AI assistants generating or modifying fixers should:

* Follow the Architecture Freeze documents.
* Preserve execution order.
* Maintain one responsibility per fixer.
* Keep outputs deterministic.
* Avoid introducing hidden dependencies.
* Produce readable and maintainable PowerShell code.
* Reuse shared utilities where appropriate.

---

# Future Expansion

Future releases may introduce additional fixers, for example:

* DocumentationFixer
* SecurityFixer
* WorkflowFixer
* ProviderFixer
* LicenseFixer
* TestFixer

New fixers should extend the system without changing the established execution model.

---

# Related Documentation

* `ARCHITECTURE.md`
* `manifest/auto-fix.json`
* `scripts/README.md`
* `docs/Script-Architecture-Freeze.md`
* `docs/Development-Workflow-Freeze.md`

---

**Version:** v1.0.0
**Status:** Official Fixers Directory Documentation
