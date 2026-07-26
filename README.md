# InvoiceRouter

<p align="center">

**Build once. Send invoices anywhere.**

*A modern, open-source n8n Community Node for unified invoice delivery across multiple payment providers.*

[![Version](https://img.shields.io/badge/version-v1.0.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![n8n Community Node](https://img.shields.io/badge/n8n-community%20node-ff6d5a.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)]()

</p>

---

## Overview

InvoiceRouter is an open-source **n8n Community Node** that provides a single, consistent interface for sending invoices through multiple payment providers.

Instead of building different workflows for every provider, InvoiceRouter normalizes invoice creation, request building, response parsing, and status checking into one unified architecture.

The project is designed for scalability, maintainability, and long-term extensibility.

---

# Why InvoiceRouter?

Managing multiple payment providers usually requires:

* Different APIs
* Different payload formats
* Different authentication methods
* Different response structures
* Different webhook behaviors

InvoiceRouter abstracts these differences behind a consistent workflow, allowing your n8n automation to remain simple while supporting multiple providers.

---

# Workflow Canvas

The following diagram represents the logical n8n execution pipeline used by **InvoiceRouter**.

```text
                                    InvoiceRouter

 ┌──────────────┐
 │    INPUT     │
 └──────┬───────┘
        │
        ▼
┌───────────────────────┐
│    Provider Loader    │
│───────────────────────│
│ • Discover Providers  │
│ • Register Providers  │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│   Provider Selector   │
│───────────────────────│
│ • Validate Provider   │
│ • Load Implementation │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│    Request Builder    │
│───────────────────────│
│ • Normalize Input     │
│ • Build Payload       │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│    Invoice Sender     │
│───────────────────────│
│ • HTTP Request        │
│ • Provider API        │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│    Status Checker     │
│───────────────────────│
│ • Parse Response      │
│ • Normalize Result    │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│  Normalized Output    │
└───────────────────────┘
```


# MVP Features

## Core Nodes

The first public release includes the following nodes:

```text
Provider Loader

↓

Provider Selector

↓

Request Builder

↓

Invoice Sender

↓

Status Checker
```

---

## Supported Providers (MVP)

* Stripe
* LemonSqueezy
* Paddle
* Polar

Additional providers will be introduced in future releases.

---

# Architecture

## Workflow

```text
Input

↓

Provider Loader

↓

Provider Selector

↓

Request Builder

↓

Invoice Sender

↓

Status Checker

↓

Normalized Output
```

Every provider follows the same execution pipeline.

---

## Node Architecture

Each node is completely self-contained.

```text
ProviderLoader/

index.ts

ProviderLoader.node.ts

ProviderLoader.description.ts

ProviderLoader.execute.ts

ProviderLoader.types.ts

ProviderLoader.constants.ts

ProviderLoader.helpers.ts

README.md
```

The same structure is used for every node.

---

## Provider Architecture

Each payment provider follows an identical architecture.

```text
providers/

stripe/

index.ts

StripeProvider.ts

StripePayload.ts

StripeParser.ts

StripeValidator.ts

StripeTypes.ts

StripeConstants.ts

StripeHelpers.ts

README.md
```

This keeps every provider isolated, modular, and easy to maintain.

---

# Project Structure

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

# Development Scripts

The project includes a complete PowerShell development toolkit.

| Script                  | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| bootstrap.ps1           | Initialize project workflow                |
| create-architecture.ps1 | Generate project architecture              |
| auto-validator.ps1      | Validate project architecture              |
| auto-fix.ps1            | Detect and repair supported project issues |
| doctor.ps1              | Project diagnostics                        |
| install.ps1             | Install dependencies                       |
| clean.ps1               | Clean build artifacts                      |
| format.ps1              | Format source code                         |
| lint.ps1                | Run ESLint                                 |
| build.ps1               | Build project                              |
| test.ps1                | Execute tests                              |
| dev.ps1                 | Development mode                           |
| release.ps1             | Prepare release package                    |
| publish.ps1             | Publish release                            |

---

# Development Workflow

```text
bootstrap

↓

create-architecture

↓

auto-validator

↓

install

↓

format

↓

lint

↓

build

↓

test

↓

dev
```

---

# Release Workflow

```text
build

↓

test

↓

release

↓

publish
```

---

# Project Goals

* Unified invoice workflow
* Modular provider system
* Consistent node architecture
* Configuration-driven development
* Maintainable codebase
* Open-source friendly design
* Production-ready release workflow

---

# Technology Stack

* TypeScript
* n8n Community Nodes
* Node.js
* PowerShell Automation
* JSON Manifest Configuration

---

# Open Source

InvoiceRouter is developed as an open-source project.

Contributions, bug reports, feature suggestions, and pull requests are welcome.

Please follow the project's coding conventions and architecture before contributing.

---

# Ecosystem

Built by **Vib Tools**

Website

https://vib.tools/

Open Source Platform

https://ygit.net/

The goal is to build reliable, developer-friendly open-source software and automation tools.

---

# Roadmap

## Version 1.x

* Core workflow
* Multi-provider architecture
* Unified invoice pipeline
* PowerShell automation toolkit
* Release workflow

---

## Future

* Additional payment providers
* More invoice operations
* Extended workflow nodes
* Improved testing
* Expanded documentation

---


# Provider Execution Canvas

Every provider follows exactly the same execution pipeline.

```text
                                   InvoiceRouter

                                          │
                                          ▼

                         ┌─────────────────────────────────┐
                         │      Selected Provider          │
                         │  Stripe / Paddle / Polar / LS   │
                         └──────────────┬──────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────────┐
                          │      ProviderValidator      │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │       Payload Builder       │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │       HTTP Request          │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  Provider REST API   │
                              └──────────┬───────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │      Response Parser        │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │     Normalized Output       │
                          └─────────────────────────────┘
```


# Version

Current Version

```text
v1.0.0
```

This section is intended to be updated with each project release to reflect the latest stable version and major milestones.

---

# License

MIT License

See the LICENSE file for details.
