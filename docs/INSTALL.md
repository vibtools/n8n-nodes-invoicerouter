# Installation

**Project:** InvoiceRouter
**Version:** v1.0.0

---

# Overview

This guide explains how to install, build, and prepare the InvoiceRouter project for local development.

The project is designed as an **n8n Community Node** written in **TypeScript** with a PowerShell-based development toolkit.

---

# Requirements

Before installing the project, make sure the following software is available.

## Required

* Node.js (LTS)
* npm
* Git
* PowerShell 7 or later

---

# Clone Repository

Clone the project.

```bash
git clone <repository-url>
```

Open the project directory.

```bash
cd InvoiceRouter
```

---

# Install Dependencies

Install all project dependencies.

```bash
npm install
```

Or use the project automation script.

```powershell
.\scripts\install.ps1
```

---

# Verify Installation

Confirm that Node.js is installed.

```bash
node --version
```

Confirm npm.

```bash
npm --version
```

---

# Project Structure

After installation, the project should resemble the following structure.

```text
InvoiceRouter/

assets/
docs/
examples/
manifest/
nodes/
providers/
shared/
tests/
scripts/

package.json
README.md
LICENSE
```

---

# Development Workflow

The recommended development sequence is:

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
```

---

# Available Scripts

| Script      | Description                  |
| ----------- | ---------------------------- |
| install.ps1 | Install project dependencies |
| clean.ps1   | Remove generated files       |
| format.ps1  | Format project source code   |
| lint.ps1    | Run static analysis          |
| build.ps1   | Compile the project          |
| test.ps1    | Execute project tests        |
| dev.ps1     | Start development mode       |

---

# Build

Compile the project.

Using npm:

```bash
npm run build
```

Using PowerShell:

```powershell
.\scripts\build.ps1
```

---

# Run Tests

Execute the test suite.

Using npm:

```bash
npm test
```

Using PowerShell:

```powershell
.\scripts\test.ps1
```

---

# Development Mode

Start the local development workflow.

```powershell
.\scripts\dev.ps1
```

---

# Project Validation

Validate the project architecture.

```powershell
.\scripts\auto-validator.ps1
```

---

# Automatic Repair

Detect and repair supported project issues.

```powershell
.\scripts\auto-fix.ps1
```

---

# Release

Prepare a release package.

```powershell
.\scripts\release.ps1
```

---

# Publish

Publish the project release.

```powershell
.\scripts\publish.ps1
```

---

# Updating

Update project dependencies.

```bash
npm update
```

If project scripts have changed, execute the validation workflow again.

```powershell
.\scripts\auto-validator.ps1
```

---

# Troubleshooting

## Dependencies not installed

Run:

```bash
npm install
```

---

## Build failed

Run:

```powershell
.\scripts\build.ps1
```

Review the build output and resolve reported errors before continuing.

---

## Validation failed

Run:

```powershell
.\scripts\auto-validator.ps1
```

Correct the reported issues before building the project again.

---

## Auto Fix

If supported issues are detected, run:

```powershell
.\scripts\auto-fix.ps1
```

---

# Related Documentation

* README.md
* docs/API.md
* docs/Development-Workflow-Freeze.md
* docs/Release-Workflow-Freeze.md
* docs/Project-Structure-Freeze.md
* docs/Coding-Standards-Freeze.md

---

# Version

```text
v1.0.0
```

---

**Status:** Official Installation Guide
