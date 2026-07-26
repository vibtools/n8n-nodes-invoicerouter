# Assets

Welcome to the **InvoiceRouter** assets directory.

The **assets/** directory contains static resources used throughout the project for documentation, branding, development, and distribution.

Assets are supporting resources—not application source code.

---

# Purpose

The assets directory exists to:

* Store project branding.
* Store documentation images.
* Store project icons and logos.
* Store visual assets.
* Organize reusable static resources.
* Keep non-code files separate from implementation.

Assets should improve the project without affecting application logic.

---

# Design Principles

Every asset should be:

* Organized
* Optimized
* Reusable
* Version controlled
* Properly licensed
* Easy to locate

Assets should remain independent from the project's runtime behavior.

---

# Directory Structure

```text id="r8jv7f"
assets/

README.md

images/
icons/
logos/
banners/
screenshots/
diagrams/
branding/
social/
```

Additional directories may be introduced as the project grows.

---

# Directory Responsibilities

## images/

General images used throughout the project.

Examples:

* Documentation illustrations
* Feature graphics
* UI previews

---

## icons/

Application and project icons.

Examples:

* Node icons
* Provider icons
* Toolbar icons
* Application icons

---

## logos/

Official project logos.

Examples:

* Light logo
* Dark logo
* SVG logo
* PNG logo

Only approved branding should be stored here.

---

## banners/

Marketing and repository banners.

Examples:

* GitHub banner
* Documentation banner
* Release banner

---

## screenshots/

Application screenshots.

Examples:

* n8n node interface
* Workflow examples
* Configuration screens
* Provider setup

Screenshots should reflect the current version of the project.

---

## diagrams/

Architecture diagrams.

Examples:

* Workflow diagrams
* Provider architecture
* Node architecture
* System architecture
* Component relationships

Architecture diagrams should remain synchronized with the Freeze documents.

---

## branding/

Official branding resources.

Examples:

* Brand colors
* Typography references
* Brand guidelines
* Visual identity assets

---

## social/

Assets prepared for social media.

Examples:

* Release announcements
* Feature cards
* Open Graph images
* Promotional graphics

---

# Supported Formats

Recommended file formats:

Images

* PNG
* SVG
* WebP

Diagrams

* SVG
* PNG

Logos

* SVG
* PNG

Animations

* GIF (only when necessary)

Avoid unnecessary large or uncompressed files.

---

# Naming Convention

Use descriptive file names.

Examples:

```text id="xv0m0z"
project-logo.svg

github-banner.png

workflow-overview.svg

provider-architecture.png

invoice-node-icon.svg
```

Avoid names such as:

```text id="vdc9jx"
image1.png

logo-new.png

final-final.png

test.svg
```

---

# Optimization

Before committing assets:

* Optimize image size.
* Preserve visual quality.
* Remove unnecessary metadata.
* Use vector formats where appropriate.
* Avoid duplicate files.

Large assets should be justified.

---

# Documentation Usage

Assets stored here may be referenced by:

* README.md
* Documentation
* GitHub Pages
* Release notes
* Examples
* Presentations

Documentation should reference assets using relative project paths.

---

# Git Policy

Project assets are part of the repository and should be committed when they represent official project resources.

Temporary images, drafts, or exported working files should not be stored here.

Development-only files belong in the **temp/** directory.

---

# Architecture Compliance

The **assets/** directory is not part of the runtime architecture.

Application functionality must not depend on documentation or branding assets unless explicitly required (for example, node icons or packaged static resources).

---

# Contribution Guidelines

When adding new assets:

* Place them in the correct subdirectory.
* Follow the naming convention.
* Optimize file size.
* Verify licensing and ownership.
* Remove obsolete assets when replacing them.
* Update documentation if the asset becomes part of official project documentation.

---

# Version

**Version:** v1.0.0

**Status:** Official Assets Documentation
