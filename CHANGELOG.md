# Changelog

## 2.0.1 - 2026-08-02 — Real email, truthful lifecycle, and release synchronization

### Runtime corrections

- Replaced the Odoo interactive send-action opener with headless `account.move.send.wizard` creation and execution.
- Added provider-side email/PDF evidence and strict `QUEUED`, `SENT`, `FAILED`, and `UNVERIFIED` semantics.
- Prevented HTTP success or wizard completion alone from producing false sent status.
- Added partial lifecycle outcomes and truthful bulk counters.
- Added checkpoint-based post-only and send-only retry resume against the existing provider invoice.
- Blocked automatic retry for unverified email outcomes.
- Removed declarative-provider 2xx-to-SENT fallback and preserved queued/unverified states.
- Corrected lifecycle writeback expressions and added evidence/checkpoint/resume columns without removing existing columns.
- Bound Odoo sent/queued evidence to mail messages created by the current send attempt; historical invoice mail records can no longer produce a false `SENT`.
- Classified Odoo email notification `pending` as queued/processing rather than terminal sent evidence.
- Preserved boolean `emailSendRequested` values through Status Checker and Google Sheets row preparation so `false` is never serialized as `true`.

### Documentation and release synchronization

- Added Odoo email evidence and lifecycle-resume developer contracts.
- Added Odoo email troubleshooting and synchronized user/template guides.
- Replaced the public personal-looking Odoo sample recipient with `customer@example.com`.
- Added validation for malformed n8n expressions and consumer-webmail sample addresses.
- Expanded the GitHub install bundle with the v2 master workflow, compatibility workflows, Odoo mode pack, common status assets, and synchronized documentation.
- Added the final release order: complete-project forensic audit, publish, n8n Community Nodes update, one-recipient live canary, then approved live bulk.

Package, lockfile, VibProject metadata, documentation version metadata, provider compatibility metadata, and release tests are synchronized to `2.0.1`. The frozen eight-node architecture and workflow contract remain version `2.0`.

## 2.0.0 - Master Universal Provider Lifecycle

### Release candidate cleanup

- Removed the local-only PowerShell clean/verify helper from tracked release source so GitHub CI validation keeps the cross-platform Node.js automation contract.
- Added ignore rules for local PowerShell helper scripts to prevent the same CI validation failure from recurring.

- Added universal provider lifecycle modes for draft/create/post/send-email execution.
- Added provider capability and lifecycle metadata.
- Added Odoo automated post/send-email lifecycle support.
- Added VibProject-compatible public structure: `config/`, `data/`, `src/`, `template/`, `PROJECT_STRUCTURE.md`, and `vibproject.ygit`.
- Added `docs/docs.minifest.ygit`; `project/` is ignored for private development planning.


## 1.6.0 — Simple bulk email workflow and Odoo auto-customer handling

- Simplifies the default workflow so `email_list` requires only `Email`; `Name` and `Address` are optional.
- Keeps provider/API/secret/config fields in the `provider` sheet instead of recipient rows.
- Adds Odoo JSON-RPC account fields to Provider Loader: `Username`, `Password`, `Database`, and `Extra Config JSON`.
- Changes the bundled production workflow to single-provider easy mode with conditional routing disabled by default.
- Adds Odoo auto customer handling: authenticate, search partner by email, create partner if missing, then create invoice.
- Adds a v1.6.0 simple bulk email workflow JSON and examples.
- Preserves the frozen eight custom-node topology and existing activation/bulk/idempotency safety controls.

## Unreleased — Step 12B n8n registry/UI install compatibility

- Removed the runtime `n8n-workflow` peer dependency declaration to reduce self-hosted n8n UI/npm install resolution risk.
- Added npm registry/search keywords for InvoiceRouter, invoice-router, bulk invoice, and invoice automation discovery.
- Prefixed all eight custom node display names with `InvoiceRouter` so the n8n editor node search can find the complete package family.
- Added `docs/freeze/v1.0/N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md` for npm publish, UI install, manual `.tgz` fallback, and troubleshooting.
- Added `scripts/diagnose-n8n-package.mjs`, packaged in the npm tarball, to validate installed manifest/node/icon bindings from the n8n runtime path.
- Added validator and smoke-test checks for registry/UI compatibility without changing workflow sending logic or the frozen eight-node topology.

## Unreleased — Step 11C professional node icon polish

- Replaced the Step 11B minimal runtime SVG icons with polished asset-card-inspired SVG icons for all eight frozen custom nodes.
- Removed text-initial glyphs from runtime icons so node cards do not depend on font rendering in n8n.
- Preserved the same `description.icon` bindings and SVG filenames, keeping runtime behavior and package paths stable.
- Added validator and smoke-test assertions for the polished icon metadata and no-text-glyph runtime icon contract.
- Documented that the SVGs are hand-authored vector interpretations of the existing Version 1.0 node-card motif, not embedded PNG conversions.

## Unreleased — Step 11B n8n node icon/card wiring

- Added branded SVG runtime icons for all eight frozen InvoiceRouter custom nodes.
- Added `description.icon` bindings using n8n file-based icon references.
- Added `scripts/copy-node-icons.mjs` and updated the build script so SVG icons are copied beside compiled node files in `dist`.
- Documented runtime icon behavior versus repository-only node-card PNG assets.
- Added validation/tests proving each custom node has an icon binding and packaged dist icon asset.

## Unreleased — Step 11 sandbox/live activation safety

- Added Invoice Sender activation safety modes for compatibility, dry-run validation, sandbox real send, and live real send.
- Added explicit sandbox confirmation token `SEND_SANDBOX_INVOICES` so sandbox real sends do not reuse the live-send approval token.
- Kept the production workflow default in Dry Run Validation mode with expected environment `sandbox` and blank confirmation fields.
- Carried activation safety metadata into raw execution, standard status, execution log, and status writeback outputs.
- Added activation fields to the status writeback branch and dry-run validation status columns.
- Added validation/tests for activation defaults and sandbox/live blocking behavior.


## Unreleased — Step 10 retry/error classification hardening

- Added normalized `errorClassification` and `retryDecision` metadata on Status Checker output.
- Added provider `Retry-After` and rate-limit reset header parsing.
- Added Status Manager retry delay caps and provider retry-after respect controls.
- Hardened non-retryable validation/auth/not-found/conflict handling so unsafe retries are blocked.
- Extended execution logs, status writeback rows, alerts, and retry queue entries with retry/error decision metadata.
- Added smoke coverage for rate-limit classification, retry-after delay capping, and non-retryable validation errors.

## Unreleased — Step 09 workflow status writeback wiring

- Added explicit built-in n8n writeback branch: Status Manager -> Prepare Status Writeback Row -> Google Sheets - Status Writeback.
- Added a Code node mapper that flattens `management.statusWriteback.values` into Sheet-safe row columns.
- Added Google Sheets `appendOrUpdate` configuration using `writeback_key` as the matching column.
- Expanded the dry-run status writeback column template to match the wired workflow branch.
- Added `STATUS_WRITEBACK_WIRING.md`, validation checks, and smoke coverage for the writeback branch.

## Unreleased — Step 08 provider request/response mapping hardening

- Added provider request-mapping metadata on prepared requests, including canonical action, method/content-type hints, idempotency header hints, and response adapter kind.
- Added response-policy metadata with success, retryable, and non-retryable HTTP status hints.
- Hardened Status Checker response extraction to support fallback response path arrays.
- Added Invoice Sender live-transport blocking for unresolved URL/header/query/body template tokens before HTTP execution.
- Carried request mapping and response policy through raw execution, standard status, execution log, and status writeback metadata.
- Added smoke coverage for request mapping metadata, unresolved-token blocking, fallback response extraction, and response-policy retry hints.

## Unreleased — Step 06 execution logging and status writeback hardening

## Step 07 - Real n8n Dry-Run Validation Package

- Added `docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md` for self-hosted n8n import/run validation before sandbox or live sends.
- Added `examples/n8n_dry_run_validation/` with provider CSV, email-list CSV, expected outcomes, and status writeback columns.
- Updated the production workflow template to default Provider Selector environment filtering to `sandbox` for first Dry Run validation.
- Included dry-run validation assets in the npm package `files` list.
- Hardened project validation and smoke tests around the dry-run validation package and safe workflow defaults.

- Added hardened Status Manager `executionLog` payloads with workflow, execution, provider, recipient, retry, error, transport, and timing fields.
- Added normalized Status Manager `statusWriteback` UPSERT payloads for downstream Google Sheets, database, webhook, or API writeback nodes.
- Added writeback key modes for request ID, idempotency key, provider invoice ID, and transaction ID.
- Added optional capped workflow static-data execution-log persistence for local troubleshooting.
- Extended Status Checker to carry recipient email, idempotency, duplicate-prevention, send-guard, and timing metadata into standard status.
- Enabled execution-log and status-writeback outputs in the bundled production workflow template.

# Changelog

## 2.0.0 - Master Universal Provider Lifecycle

- Added universal provider lifecycle modes for draft/create/post/send-email execution.
- Added provider capability and lifecycle metadata.
- Added Odoo automated post/send-email lifecycle support.
- Added VibProject-compatible public structure: `config/`, `data/`, `src/`, `template/`, `PROJECT_STRUCTURE.md`, and `vibproject.ygit`.
- Added `docs/docs.minifest.ygit`; `project/` is ignored for private development planning.


## Unreleased — Step 12B n8n registry/UI install compatibility

- Removed the runtime `n8n-workflow` peer dependency declaration to reduce self-hosted n8n UI/npm install resolution risk.
- Added npm registry/search keywords for InvoiceRouter, invoice-router, bulk invoice, and invoice automation discovery.
- Prefixed all eight custom node display names with `InvoiceRouter` so the n8n editor node search can find the complete package family.
- Added `docs/freeze/v1.0/N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md` for npm publish, UI install, manual `.tgz` fallback, and troubleshooting.
- Added `scripts/diagnose-n8n-package.mjs`, packaged in the npm tarball, to validate installed manifest/node/icon bindings from the n8n runtime path.
- Added validator and smoke-test checks for registry/UI compatibility without changing workflow sending logic or the frozen eight-node topology.

## Unreleased — Step 05 idempotency and duplicate-send prevention

- Added Request Builder idempotency key modes for existing request IDs, provider/invoice keys, and provider/invoice/recipient keys.
- Added Invoice Sender duplicate-send prevention with live-mode idempotency reservation, workflow static-data retention, in-process reservations, duplicate TTL, and reservation TTL settings.
- Added `DUPLICATE` transport/result handling so repeated live sends are blocked without provider HTTP transport or failure alerts.
- Enabled workflow-scoped Provider + Invoice + Recipient idempotency and duplicate prevention in the bundled production workflow template.
- Added smoke coverage proving duplicate live sends are blocked after the first HTTP transport call.

## Unreleased — Step 04 provider-specific strict validation

- Added Provider Loader auth-material checks for bearer, OAuth2, basic, token, session, and custom header profiles.
- Added Request Builder strict provider validation for invoice essentials, profile essentials, and provider-specific custom fields.
- Added `readyRequest.providerValidation` output and sendGuard validation checks so incomplete provider requests are blocked before Invoice Sender transport.
- Enabled strict provider validation in the bundled production workflow template.
- Added smoke tests for strict provider validation and sendGuard blocking of provider-validation failures.

## Unreleased — Step 03 conditional routing and send guard

- Added Provider Selector conditional routing by routing rules or per-recipient Provider/Action/Environment fields.
- Added blocked allocation handling so unrouted items become `BLOCKED` instead of falling through to send.
- Added Request Builder `sendGuard` metadata and strict guard mode.
- Added Invoice Sender guard enforcement and explicit `SEND_REAL_INVOICES` live-mode confirmation when Dry Run is disabled.
- Updated Status Checker/Status Manager to treat guarded `BLOCKED` items as non-transport executions.
- Added smoke tests for conditional routing, unrouted blocking, and live-mode guard blocking.

## Unreleased — Step 02 configuration cleanup

- Clarified that the bundled workflow is an inactive, Dry Run-first template, not a ready-to-send live workflow.
- Documented the separation between the demo/reference provider workbook and a private production Google Sheet.
- Added the production setup checklist for real n8n onboarding gates.
- Updated the workflow sticky note with explicit demo-vs-real and sandbox-before-live guidance.

## 1.5.0 — Hardened bulk real-send release identity

Release identity for the complete Step 01-11E hardening series. This version keeps the frozen eight-node architecture while preparing the package for final self-hosted n8n installation, dry-run validation, sandbox API proof, live canary testing, and GitHub/npm publication.

### Added

- Conditional provider/action/environment routing for per-recipient bulk invoice distribution.
- Strict provider-specific validation before Invoice Sender transport.
- Send guard enforcement, unresolved-token blocking, and provider request/response policy metadata.
- Dry-run validation, sandbox real-send, and live real-send activation safety modes.
- Idempotency and duplicate-send prevention for real invoice transport.
- Execution logging, status writeback payloads, and explicit Google Sheets status writeback workflow branch.
- Retry/error classification, provider `Retry-After` parsing, retry delay capping, and guarded automatic retry branch wiring.
- Bulk run safety controls: item cap, uniform environment requirement, real-send delay, failed-send abort threshold, critical-error abort, and separate sandbox/live bulk confirmations.
- Production preset self-check to block accidental unsafe UI reset/config edits before transport.
- Polished SVG runtime node icons packaged beside compiled node files.
- Master v1.5.0 build/install/live-test runbook.

### Changed

- Package version is now `1.5.0`.
- README and freeze documentation now describe the v1.5.0 release identity and acceptance boundary.
- Package files list now includes all release-critical validation, activation, bulk-safety, retry, icon, and live-test documentation.
- Automated test expectation updated to v1.5.0.

### Safety boundary

`v1.5.0` is build/install/live-test ready. Live production sending is approved only after the project passes the documented self-hosted n8n dry-run, provider sandbox API send, retry/writeback verification, and one-row live canary acceptance checks.

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

The previous generic REST runtime remains in Git history and is superseded by the 1.2.0 frozen implementation and the v1.5.0 hardened release identity.

## Step 11D - Bulk Run Safety Controls

- Added Invoice Sender run-level bulk safety controls for maximum items per execution, uniform environment enforcement, throttling, failed-send aborts, critical-error aborts, and sandbox/live bulk confirmation phrases.
- Added bulk safety metadata to raw execution, standard status, execution log, status writeback, and workflow results.
- Added `BULK_RUN_SAFETY.md` and expanded status writeback columns with bulk-run fields.
- Kept the frozen eight-node architecture and package version unchanged.

## Step 11E - Production preset self-check and retry wiring

- Added Invoice Sender production preset self-check modes for dry-run, sandbox real send, and live real send.
- Added workflow-level automatic retry branch: Status Manager -> Prepare Retry Request -> Wait Before Retry -> Invoice Sender.
- Added preset self-check metadata to Status Checker, Status Manager, execution logs, and writeback rows.
- Added documentation and validation for retry loop wiring.
### Release-blocking hardening

- Completed lifecycle writeback fields for customer/post/email-send status.
- Added provider template manifests, canonical invoice_results headers, docs manifest repair, and template validation.
- Added release-source audit tooling for clean publish artifacts.



## Step 14D / v2.0.0 Declarative Provider Recipe Runtime

Added a declarative HTTP provider recipe runtime so compatible REST/JSON invoice providers can define customer, invoice, post/finalize, and email-send steps in provider recipe JSON instead of requiring core node code changes. This is intended for compatible providers; non-standard OAuth, webhook, UI-only, or SDK-only flows may still require a dedicated adapter.
