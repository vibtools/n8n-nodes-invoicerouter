# Temp

Welcome to the **InvoiceRouter** temporary workspace.

The **temp/** directory is reserved for short-lived files generated during development, testing, building, debugging, and automation.

Nothing inside this directory should be considered part of the project's source code.

---

# Purpose

This directory exists to isolate temporary artifacts from the rest of the project.

Typical contents include:

* Temporary build files
* Debug output
* Generated logs
* Cache files
* Temporary exports
* Scratch files
* Intermediate processing results

These files are disposable and may be deleted at any time.

---

# Important Rules

Everything inside **temp/** is considered temporary.

Files in this directory:

* Should not be committed to Git.
* Should not be referenced by production code.
* Should not contain permanent project assets.
* Should not be required for project builds.

The project must function correctly even if the entire **temp/** directory is removed.

---

# Typical Structure

```text
temp/

README.md

build/
cache/
debug/
exports/
logs/
scratch/
```

Subdirectories may change depending on development needs.

---

# Allowed Contents

Examples of acceptable files:

* Build cache
* Generated JSON
* Debug reports
* Temporary screenshots
* Development logs
* Validation output
* Test artifacts
* Local experiment files

---

# Prohibited Contents

Do **not** store:

* Source code
* Documentation
* Production assets
* Configuration files
* Secrets
* API keys
* Tokens
* Permanent test data

These belong in their respective project directories.

---

# Git Policy

The **temp/** directory should remain in the repository so developers have a consistent location for temporary files.

Only **README.md** (and optionally a `.gitkeep` file) should be tracked by Git.

Everything else should be ignored using `.gitignore`.

Example:

```gitignore
temp/*
!temp/README.md
!temp/.gitkeep
```

---

# Automation

Project automation scripts may use this directory for:

* Build output
* Validation reports
* Auto-fix reports
* Diagnostic logs
* Temporary manifests

Automation should clean up temporary files whenever possible.

---

# Cleanup

Developers are encouraged to periodically remove unnecessary temporary files.

Project cleanup scripts may safely delete the contents of this directory without affecting the project.

---

# Architecture Compliance

The **temp/** directory is **not** part of the project's architecture.

No production module should depend on files stored here.

---

# Version

**Version:** v1.0.0

**Status:** Official Temporary Workspace Documentation
