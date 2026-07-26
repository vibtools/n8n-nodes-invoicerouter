# Changelog

## 1.1.0 - Real API runtime and workflow release

- Added the InvoiceRouter API n8n credential.
- Added bearer, API-key, basic, query, and no-auth modes.
- Added HTTPS enforcement and configurable timeouts.
- Implemented real create, create-and-send, send-existing, and custom HTTP operations.
- Added request idempotency support.
- Added configurable request endpoints, methods, bodies, headers, queries, and response paths.
- Implemented real provider status retrieval and normalized status mapping.
- Expanded Google Sheets invoice normalization and validation.
- Added an importable Google Sheets production workflow template.
- Added runtime create/send tests and dry-run no-network tests.
- Updated GitHub Release to attach npm package, workflow JSON, and checksums.
- Made npm publishing optional when `NPM_TOKEN` is absent.

## 1.0.0 - Forensic audit repair

- Repaired project structure, CI workflows, TypeScript configuration, scripts, manifests, and build scaffolds.
