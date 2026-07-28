# Changelog

## 1.2.0 — Version 1.0 final implementation

- Registered all eight frozen InvoiceRouter custom nodes.
- Rebuilt Provider Loader around the 18-column Google Sheets contract with validation, duplicate detection, secret masking, and a runtime credential vault.
- Added Provider Selector shared pool state, sequential/parallel modes, locks, timeout recovery, rate limiting, circuit breaker, health scoring, cooldown, and allocation strategies.
- Added Invoice Template with fixed fields, repeatable line items, totals, custom fields, validation, and dynamic tags.
- Added Email List with auto mapping, email validation, deduplication, name generation, custom columns, and batch reservation.
- Rebuilt Request Builder as the only three-input merge layer and added presets for all 19 workbook provider names.
- Rebuilt Invoice Sender as a single-request execution layer with late secret injection, response metadata, latency/size capture, and redaction.
- Rebuilt Status Checker as response analysis only; it no longer performs a second provider request by default.
- Added Status Manager policy, retry queue events, metrics/analytics events, alerts, audit output, workflow results, and provider feedback.
- Added the full importable production workflow JSON.
- Redesigned README with the final architecture diagram and production setup instructions.
- Added end-to-end smoke coverage for the full eight-node pipeline.
- Hardened queued and dry-run handling, JSON-string response parsing, dynamic tags in overrides, secret-safe transport errors, and idempotent feedback replay.

## 1.1.0 — Previous five-node migration baseline

The previous generic REST runtime remains in Git history and is superseded by 1.2.0.
