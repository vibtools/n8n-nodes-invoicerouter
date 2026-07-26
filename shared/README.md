# Shared

Welcome to the **InvoiceRouter** shared directory.

This directory contains reusable components that are common across the entire project.

Anything placed inside **shared/** should be generic, reusable, and independent of any specific provider, node, or workflow implementation.

---

# Purpose

The shared directory exists to:

* Eliminate duplicated code.
* Centralize reusable logic.
* Improve maintainability.
* Promote consistency across the project.
* Support modular architecture.

No business logic or provider-specific implementation should exist here.

---

# Design Principles

Everything inside **shared/** should be:

* Reusable
* Generic
* Stateless whenever possible
* Well documented
* Easy to test
* Independent

Shared components should serve the project, not individual providers.

---

# Directory Structure

```text
shared/

README.md

constants/
helpers/
interfaces/
types/
utils/
```

Each subdirectory has a single responsibility.

---

# Folder Responsibilities

## constants/

Stores project-wide constants.

Examples:

* Default values
* Shared configuration keys
* Common status values
* Global identifiers

Do not place provider-specific constants here.

---

## helpers/

Reusable helper functions.

Examples:

* Object utilities
* String helpers
* Array helpers
* Date utilities
* Validation helpers

Helpers should not contain business logic.

---

## interfaces/

Shared TypeScript interfaces.

Examples:

* Provider interfaces
* Node interfaces
* Request interfaces
* Response interfaces

Interfaces define contracts shared across multiple modules.

---

## types/

Shared TypeScript types.

Examples:

* Enums
* Union types
* Generic types
* Common aliases

Types should remain provider-independent.

---

## utils/

General-purpose utilities.

Examples:

* Data transformation
* Formatting
* Serialization
* Parsing
* Common utility functions

Utilities should remain generic and reusable.

---

# What Belongs Here

Examples of acceptable shared components:

* Common interfaces
* Shared types
* Generic validators
* Common helper functions
* Project-wide constants
* Utility functions
* Generic error classes

These components should be usable by multiple modules without modification.

---

# What Does NOT Belong Here

The following should **never** be placed inside **shared/**:

* Stripe logic
* Paddle logic
* Polar logic
* LemonSqueezy logic
* Provider payload builders
* Provider parsers
* Provider validators
* Node execution logic
* Workflow orchestration
* HTTP provider implementations

These belong in their respective modules.

---

# Dependency Rules

The shared directory must not depend on:

* providers/
* nodes/
* workflow-specific modules

Instead, other modules may depend on **shared/**.

Dependency direction:

```text
shared/

        ▲
        │

providers/
nodes/
scripts/
tests/
```

Shared is a foundational layer and should remain independent.

---

# Naming Convention

Use clear and descriptive names.

Examples:

```text
DateHelper.ts

StringHelper.ts

HttpMethod.ts

ProviderInterface.ts

InvoiceStatus.ts
```

Avoid generic names such as:

```text
helper.ts

utils.ts

common.ts

temp.ts
```

---

# Development Rules

Every file should have one responsibility.

Avoid:

* Large utility files
* Mixed responsibilities
* Hidden dependencies
* Circular imports

Favor small, focused, reusable modules.

---

# Architecture Compliance

Everything in **shared/** must comply with:

* DEVELOPER_GUIDE.md
* Coding-Standards-Freeze.md
* Project-Structure-Freeze.md
* Manifest-Architecture-Freeze.md

The shared layer is part of the project's frozen architecture.

---

# Contribution Guidelines

Before adding a new file:

* Verify that it is reusable.
* Confirm it is not provider-specific.
* Check for an existing implementation.
* Keep it generic.
* Document significant additions when necessary.

If a component is only used by one module, it probably belongs in that module instead of **shared/**.

---

# Version

**Version:** v1.0.0

**Status:** Official Shared Module Documentation
