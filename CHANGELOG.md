# Changelog

## 2.1.2 - 2026-08-05 — Corrective release synchronization

- Published only the three approved corrections: capability-driven Odoo version handling, original-row provider preflight writeback, and safe recovery of pre-provider failed campaign leases.
- Kept provider selection account-count agnostic; all enabled valid provider rows remain eligible without a three-account lock.
- Preserved the frozen eight-node architecture, public APIs, dependencies, invoice creation/posting/email lifecycle, retry semantics, and canonical workflow filename.
- Synchronized npm, VibProject, documentation, provider-template, evidence-template, validation-gate, and regression-test release metadata to `2.1.2`.
- Kept `template/providers/odoo/n8n-import-workflow-production-v2.1.1.json` as the compatibility filename; the corrected release bytes are published under Git tag `v2.1.2`.

## 2.1.1 final corrective forensic audit — 2026-08-04

- Fixed the exact n8n 2.31.6 engine import harness to use a temporary `--separate` directory, allowing n8n to generate a transient workflow ID without changing the canonical public workflow JSON.
- Fixed the Windows exact-engine harness by invoking npm through Node instead of directly spawning `.cmd` shims.
- Expanded the n8n 2.31.6 gate to import/export the complete 126-node/141-edge canonical workflow.
- Persisted the exact built stable reference in the pre-provider `PROVIDER_PENDING` envelope.
- Reconstructed unresolved `PROVIDER_PENDING` operations on startup and forced stable-reference reconciliation before new provider side effects.
- Added an immediate pre-side-effect campaign lease reread/Run_ID/expiry verification.
- Bound live evidence to the engine evidence, package tarball, canonical workflow, sanitized artifacts, and reviewer metadata.
- Made tag releases validate npm publication credentials before GitHub Release creation.
- Clarified that the 66-second marker test is a separate-process rehydration regression; real n8n restart/worker resume remains a live-pilot acceptance item.
- Corrected publication order so tag-driven GitHub/npm release completes before the Community Nodes update and reviewed live canary/pilot evidence; live evidence remains mandatory for production bulk approval.

## 2.1.1 - 2026-08-03 — Production corrective patch

### Phase 04 — Odoo capability/version/issuer compatibility

- Added one shared Odoo 18/19 capability manifest used by preflight, sender, and tests.
- Added version-specific send-wizard field profiles and a fail-closed unknown-major policy.
- Synchronized preflight model/field probes with the sender's actual Odoo surface.
- Added authenticated Odoo company identity evidence and additive provider columns.
- Required `Issuer_Key` for Odoo failover groups and blocked an entire group on issuer/company mismatch.
- Kept create/post/send permission explicitly unproven until live-canary side effects succeed.


- Added Phase 03 Odoo evidence precedence so attempt-bound `SENT`/`QUEUED` evidence remains authoritative even when the send-wizard RPC transport is ambiguous.
- Preserved structured Odoo operation metadata through non-throwing verification helpers; ambiguous send transport without terminal evidence now returns `UNVERIFIED` for manual review.
- Replaced arbitrary first-contact selection with case-insensitive exact partner lookup, a two-record ambiguity probe, and fail-closed duplicate-contact handling.
- Added RFC display-name recipient extraction and strict `ir.attachment` PDF identity validation against MIME type, invoice model/id, current-attempt message attachment, and `invoice_pdf_report_id`.
- Added Phase 02 durable campaign reconstruction from `email_list`, `retry_queue`, `invoice_results`, and `campaign_report`.
- Added one-pending-`Campaign_ID` enforcement before provider work.
- Added `campaign_report` run lease acquisition, reread verification, expiry, release, revision, and last-attempt fields.
- Made Sheet-derived campaign state the correctness source while retaining memory/static data only as caches.

### Runtime corrections

- Added Phase 01 runtime rehydration: retry/failover waits now reread the provider Sheet, rerun Provider Loader, rebuild the process-local pool/vault, and re-enter required-profile or fresh-profile selection before transport.

- Added safe optional-input handling so the canonical embedded Request Builder path works in real n8n while legacy three-input workflows remain compatible.
- Replaced externally incompatible Odoo `check_access_rights` preflight calls with version discovery, `fields_get`, currency discovery, and read-only model probes.
- Preserved no-account jobs as `QUEUED` instead of converting them to terminal failure.
- Added campaign-wide maximum, failure threshold, inter-send delay, confirmation, pause, and restart-safe state outside the one-item sender batch.
- Added stable campaign/job-derived dynamic invoice references and reconciliation of ambiguous customer/invoice/post side effects.
- Added intended-recipient-bound Odoo mail evidence and structured Odoo JSON-RPC error metadata.
- Blocked unsupported nonzero Odoo global tax/discount/shipping totals before transport instead of allowing provider-total mismatch.

### Workflow, Sheets, and reporting

- Persisted `Job_ID` before provider execution and serialized `PROCESSING`, provider execution, terminal status, retry queue, provider/account report, campaign report, and loop continuation.
- Added durable `writeback_queue` staging and writeback-only repair before new provider work.
- Corrected retry/account allocation counters and changed `campaign_report` to one aggregate row per campaign with pause reason.
- Added the URL-importable canonical workflow `template/providers/odoo/n8n-import-workflow-production-v2.1.1.json`.
- Preserved all eight custom nodes, existing public APIs, existing compatibility workflows, and zero runtime dependencies.

## 2.1.0 - 2026-08-03 — Bulk reliability, durable reporting, and safe account failover

### Runtime and workflow

- Added one-item just-in-time provider allocation in the canonical Odoo production workflow.
- Added `campaignJob` idempotency based on provider, failover group, campaign, job, and action.
- Added side-effect-aware same-account retry for post-only and send-only lifecycle resume.
- Added pre-side-effect account failover with attempted-profile exclusion and failover-group isolation.
- Added structured configuration and quota error classification so invalid database/currency errors are not treated as generic network failures.
- Added evidence-based provider status, cooldown, and automatic disable decisions.
- Added fixed custom customer-name generation in Email List without changing existing name modes.

### Google Sheets and operations

- Added real-time `email_list.status`, stable `Job_ID`, `Campaign_ID`, attempts, last account, and last error fields.
- Added managed provider status, disable reason, cooldown, error, and cumulative counter columns.
- Added `retry_queue`, `account_report`, and `campaign_report` tabs/templates.
- Added writeback-only operational payloads that never route a Sheets failure back into Invoice Sender.
- Updated the Odoo production workflow and workbook identity to v2.1.0 while preserving compatibility workflows and the frozen eight-node topology.

Per-account configured RPM, concurrency, and daily limits are intentionally excluded. Existing global bulk safety controls remain.

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

## 2.1.1 - 2026-08-03 — Production corrective patch

### Runtime corrections

- Added safe optional-input handling so the canonical embedded Request Builder path works in real n8n while legacy three-input workflows remain compatible.
- Replaced externally incompatible Odoo `check_access_rights` preflight calls with version discovery, `fields_get`, currency discovery, and read-only model probes.
- Preserved no-account jobs as `QUEUED` instead of converting them to terminal failure.
- Added campaign-wide maximum, failure threshold, inter-send delay, confirmation, pause, and restart-safe state outside the one-item sender batch.
- Added stable campaign/job-derived dynamic invoice references and reconciliation of ambiguous customer/invoice/post side effects.
- Added intended-recipient-bound Odoo mail evidence and structured Odoo JSON-RPC error metadata.
- Blocked unsupported nonzero Odoo global tax/discount/shipping totals before transport instead of allowing provider-total mismatch.

### Workflow, Sheets, and reporting

- Persisted `Job_ID` before provider execution and serialized `PROCESSING`, provider execution, terminal status, retry queue, provider/account report, campaign report, and loop continuation.
- Added durable `writeback_queue` staging and writeback-only repair before new provider work.
- Corrected retry/account allocation counters and changed `campaign_report` to one aggregate row per campaign with pause reason.
- Added the URL-importable canonical workflow `template/providers/odoo/n8n-import-workflow-production-v2.1.1.json`.
- Preserved all eight custom nodes, existing public APIs, existing compatibility workflows, and zero runtime dependencies.

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

### v2.1.1 Phase 05
- Added pre-provider durable operation envelopes, result/checkpoint updates, immutable `Row_ID`, and provider-row `Profile_ID` matching.

### v2.1.1 Phase 06

- Added monotonic campaign/account report revisions with `Base_Revision`, `Revision`, `Writer_Run_ID`, and `Aggregate_Source`.
- Added fresh read/verify/write gates that reject stale campaign writers, wrong run owners, account stale writers, and revision gaps.
- Rebuilt campaign counters from durable recipient/result/retry evidence instead of retaining stale maximum values from a prior aggregate row.
- Made highest-revision `account_report` rows authoritative when rebuilding per-account runtime aggregates.
- Made writeback repair skip already-applied/older report payloads and fail closed on revision gaps.
- Added revisioned issuer-mismatch account reporting with Odoo issuer/company evidence.
- Kept package version `2.1.1`, runtime dependencies, public APIs, and the frozen eight exported custom nodes unchanged.

### v2.1.1 Phase 07 — Final release gate

- Added an exact `n8n@2.31.6` dry-run workflow-engine smoke harness and CI evidence artifact.
- Added cross-process restart/other-worker runtime rehydration regression coverage for a durable 66-second wait marker.
- Added boundary-aware redaction for one-to-four-character secrets without corrupting ordinary error text.
- Added Odoo 18 and Odoo 19 end-to-end fixtures covering preflight, invoice/post/send evidence, PDF validation, status checking, and management.
- Added sanitized canary and pilot evidence templates plus a fail-closed final release gate.
- Kept GitHub/npm/live production release blocked until exact engine and reviewed live evidence pass.

### Final corrective forensic audit

- Corrected initial `Row_ID` persistence to update the exact virtual Google Sheets `row_number` instead of attempting an upsert against a newly generated key that was not yet present in the source row.
- Added regression and validation gates preventing blank-key identity writes from appending duplicate recipient rows.

- Replaced non-reproducible full engine-evidence file binding with deterministic package-content and engine-fact binding so Windows-reviewed canary/pilot evidence remains verifiable after CI regenerates timestamped engine evidence.

- Enforced LF source checkout and TypeScript output so deterministic Phase 07 package-content evidence remains reproducible across Windows and Linux CI.

- Required canary/pilot supporting artifacts to exist beneath the controlled evidence directory and match their declared SHA-256; placeholder hashes no longer pass the release gate.
