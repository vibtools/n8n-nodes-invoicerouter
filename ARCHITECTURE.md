# InvoiceRouter Architecture

## v2.1.1 Production Corrective Layer

The frozen eight-node topology remains unchanged. v2.1.1 corrects the v2.1.0 production workflow without adding custom nodes or runtime dependencies. The canonical Odoo workflow is `template/providers/odoo/n8n-import-workflow-production-v2.1.1.json`; the same file is retained as `n8n-import-workflow-live-bulk.json` for compatibility.


### Phase 02 durable campaign state and run lease

The campaign correctness source is now the managed Sheets. Startup reads `email_list`, `retry_queue`, `invoice_results`, `campaign_report`, and `account_report`, then reconstructs admitted/terminal job IDs, campaign counters, pause state, last attempt, run lease, and revision. `CampaignStore` merges that Sheet seed with same-run process state; process memory and workflow static data no longer replace Sheet evidence.

Before `Loop Over Recipient Jobs`, the workflow writes an `ACTIVE` lease keyed by `Campaign_ID`, rereads `campaign_report`, and verifies `Run_ID`, `Revision`, and `Lock_Expires_At`. A different active unexpired owner blocks before Provider Selector. After the loop, the workflow rereads and releases the same lease. Mixed pending campaign IDs are rejected before job identity/provider work.

```text
campaign_report read -> Sheet-derived seed -> one Campaign_ID check
-> lease acquire -> lease reread/verify -> one-item loop
-> outcome revisions -> final lease release
```

The lease uses additive columns only and does not change existing public node names, custom-node count, APIs, libraries, or provider lifecycle behavior.


### Phase 03 Odoo truthfulness boundary

Invoice Sender preserves structured `OdooOperationError` metadata through internal read/send probes. Email-state precedence is current-attempt and recipient-bound:

```text
SENT evidence
-> QUEUED evidence
-> explicit failure evidence
-> ambiguous wizard transport without terminal evidence = UNVERIFIED
-> definitive pre-send/wizard validation failure = FAILED
```

`res.partner` lookup uses `=ilike`, reads at most two records, normalizes the returned address, and blocks zero-trust selection when more than one exact contact exists. RFC display-name mail recipients are normalized before comparison.

PDF proof is evaluated independently after invoice metadata read. `ir.attachment` must have MIME `application/pdf`, `res_model=account.move`, `res_id=<invoice id>`, and the expected `invoice_pdf_report_id` must also be attached to the current-attempt message. This proof is recorded under `emailEvidence.pdfEvidence`; it does not convert a verified email transport state into an inbox-delivery claim.


### Phase 04 Odoo capability and issuer boundary

`shared/odoo/OdooCapabilityManifest.ts` is the single runtime contract for Odoo 18/19 model fields, sender read shapes, and method names. Provider Loader resolves the profile from `common.version`; unsupported major versions are excluded before authentication. Sender consumes the same resolved profile and rejects an explicitly unsupported or issuer-incompatible request.

```text
common.version -> Odoo 18/19 profile
-> authenticate -> read-only fields/model probes
-> authenticated user's company -> res.company identity
-> Issuer_Key/company group verification
-> pool registration only when compatible
```

Preflight evidence is additive: `Odoo_Server_Version`, `Odoo_Major_Version`, `Capability_Status`, `Issuer_Key`, `Company_ID`, `Company_Name`, and `Issuer_Compatibility`. `CAPABILITY_VALIDATED_SIDE_EFFECT_PERMISSION_UNPROVEN` is deliberate: `fields_get`, `read`, and `search_count` validate shape/readability but do not prove create/post/send authorization.

Issuer validation happens before runtime pool registration. A mismatched Odoo failover group is removed as a group; no arbitrary cross-company failover is allowed. This does not rename provider rows, change the eight-node architecture, or add dependencies.

Corrected execution order:

```text
writeback-only repair -> provider preflight -> durable Job_ID/retry checkpoint
-> one-item loop -> campaign admission/delay -> provider allocation checkpoint
-> Request Builder -> Invoice Sender -> Status Checker -> Status Manager
-> pending writeback bundle -> ordered Sheet writes -> bundle complete
-> retry/failover Wait -> provider Sheet reread -> Provider Loader pool/vault rehydration
-> required-profile retry or fresh-profile failover selection -> Request Builder/Sender
-> finalize -> next recipient
```

Request Builder supports both the historical three-input contract and the canonical embedded single-input contract. Odoo preflight uses public JSON-RPC calls (`version`, `authenticate`, `search_read`, `fields_get`, and `search_count`) and never invokes the unavailable external `check_access_rights` method.

Campaign safety is persisted across the one-item loop: total eligible jobs, maximum jobs, failure/manual-review threshold, inter-send delay, critical pause, and `Pause_Reason`. A durable `writeback_queue` records the complete Sheet write bundle before invoice/result/status/report updates. The repair path is isolated from Provider Selector and Invoice Sender.

Odoo duplicate safety uses stable Campaign+Job references, structured provider errors, side-effect reconciliation, original-profile locking after allocation, and manual review when a posted recovered invoice has no trusted email checkpoint. Current-attempt email evidence is additionally bound to the intended partner/email.


### v2.1.1 Phase 01 runtime rehydration

Provider pools and credential material remain process-local runtime state. The canonical Odoo retry/failover path therefore treats every Wait boundary as a possible process/worker boundary. It rereads `provider`, executes the existing Provider Loader to rebuild `RuntimeStore` pool/vault entries under the stable workflow/batch scope, restores the waited job, and re-enters Provider Selector. This adds no custom node type and preserves the eight-node package architecture.

## v2.1.0 Bulk Reliability Layer

The eight-node topology remains frozen. The canonical Odoo production workflow serializes recipient jobs through a one-item loop so Provider Selector allocates immediately before each send. Status Manager feedback is available before the next recipient allocation.

Data flow:

```text
provider -> Provider Loader -> email_list -> Email List -> Invoice Template
-> Loop Over Recipient Jobs -> Provider Selector -> Request Builder -> Invoice Sender
-> Status Checker -> Status Manager
```

Status Manager branches into invoice results, recipient status, provider status, retry queue, account report, and campaign report writebacks. In the canonical Odoo workflow, both approved same-account retry and pre-side-effect failover wait, reread the provider Sheet, rerun Provider Loader, and re-enter Provider Selector. Retry requires the original profile; failover excludes attempted profiles. Sheet writeback branches never return directly to the transport path.

Provider Loader performs optional read-only Odoo account preflight before pool registration. The canonical production template enables authentication, active-currency, and model-access checks. Each managed Google Sheets write branch retries its write independently up to three times.

Stable job identity is `Campaign_ID + Job_ID`. The `campaignJob` idempotency key excludes the current provider profile for safe pre-side-effect failover; once a provider invoice exists, lifecycle checkpoint data locks post/send resume to the original profile/database.

## v2.0.0 Master Universal Provider Lifecycle

The eight-node architecture remains frozen. v2.0.0 adds a universal lifecycle layer over provider adapters: customer resolve/create, invoice create, invoice post/finalize, invoice email send, and normalized lifecycle status writeback.


## v1.6.0 simple bulk email workflow boundary

The historical v1.6.0 boundary kept Version 1.0 with exactly eight custom nodes. v1.6.0 does not add or remove custom node types; it changes the default workflow contract so provider credentials stay in the `provider` sheet and recipient rows require only `Email`, with optional `Name` and `Address`.

Odoo customer handling is now automated by the sender path: Odoo credentials are loaded from the provider account row, the customer is searched by email, a missing partner can be created automatically, and the invoice is then created for that partner. The first workflow import remains dry-run safe.

## v1.5.0 release boundary

The package release identity is `v1.5.0`. The architectural freeze remains Version 1.0 with exactly eight custom nodes. v1.5.0 does not add custom node types or replace the data-flow architecture; it hardens the frozen flow for bulk invoice sending, guarded real API activation, retry/writeback evidence, preset self-checks, and packaged node branding.

Operationally, v1.5.0 is build/install/live-test ready. Production approval requires the documented self-hosted n8n dry-run, provider sandbox API send, retry/writeback validation, and live canary runbook evidence.

The Version 1.0 responsibilities are frozen in [`VERSION_1_0_FREEZE.md`](VERSION_1_0_FREEZE.md) and [`docs/freeze/v1.0/`](docs/freeze/v1.0/).

![InvoiceRouter architecture](assets/architecture/invoice-router-architecture-v1.0.png)

## Runtime layers

1. **Source:** built-in Manual Trigger and Google Sheets nodes.
2. **Normalization:** Provider Loader and Email List.
3. **Selection:** Provider Selector and its runtime account pool.
4. **Invoice data:** Invoice Template.
5. **Merge:** Request Builder combines account, template, and recipient through three inputs, then attaches `sendGuard` approval metadata and a structured idempotency key.
6. **Execution:** Invoice Sender injects runtime secrets, enforces send guard/activation/duplicate/bulk checks, executes provider lifecycle stages, records provider evidence, and accepts only approved lifecycle-resume requests.
7. **Analysis:** Status Checker combines transport and lifecycle evidence into success, partial, failure, or neutral standard status.
8. **Management:** Status Manager creates decisions/events, truthful bulk counters, provider feedback, safe retry-resume requests, and normalized execution-log/status-writeback payloads.
9. **Writeback wiring:** Built-in Code and Google Sheets nodes flatten and upsert `management.statusWriteback` into the configured `invoice_results` Sheet.

## Feedback model

The workflow does not contain a physical cyclic connection. Status Manager updates the InvoiceRouter runtime pool and best-effort workflow static feedback. A later Provider Selector execution reads that state. This prevents an uncontrolled execution loop.

## State boundary

- Secret material is process-local and referenced by `credentialRef`.
- Provider health/locks/cooldowns are process-local for the active runtime.
- Status Manager stores a bounded feedback history in workflow static data when the n8n runtime exposes it.
- Status Manager can optionally persist a capped `invoiceRouterExecutionLog` static-data array, but external Sheet/DB writeback should be done by explicit downstream n8n nodes.
- Invoice Sender stores a bounded `invoiceRouterIdempotency` history in workflow static data when available, and also keeps in-process live-send reservations for active duplicate prevention.
- Multi-process shared pools and cross-worker idempotency beyond workflow static data require a future external-state freeze.

## Importable workflow

`workflows/InvoiceRouter-v2-master-universal.json` is the canonical master workflow template. `workflows/InvoiceRouter-v1-production.json` and `workflows/InvoiceRouter-v1.6-simple-bulk-email.json` remain compatibility/reference templates. It is an inactive, Dry Run-first template with placeholder Google Sheet and credential IDs. The template is production-shaped, but it is not production-configured until the private provider Sheet, email Sheet, Provider Selector filters or conditional routing rules, provider-specific values, sendGuard review, and sandbox verification are completed.

The reference workbook under `examples/google_sheets/` is a demo/preset contract artifact. It must be copied to a private Google Sheet before real use; demo rows or example conditional notes must not be treated as runtime approval conditions. Runtime conditional routing lives in Provider Selector settings. Guarded send approval lives in Request Builder `sendGuard` metadata and Invoice Sender guard enforcement. Duplicate-send prevention lives in Request Builder idempotency metadata plus Invoice Sender runtime/static-data reservations.

## Provider-specific validation boundary

Provider Loader validates provider Sheet transport/account rows and auth-material completeness. Request Builder validates the selected provider, invoice template, recipient, and provider-specific custom fields together, then records errors in `readyRequest.providerValidation`. Send Guard treats any provider-validation error as a block-before-send condition.

## Idempotency boundary

Request Builder owns idempotency-key construction because it can inspect the selected provider profile, invoice, and recipient together. Invoice Sender owns duplicate-send enforcement because it is the last gate before provider HTTP transport. A `DUPLICATE` result is treated as a guarded non-transport outcome by Status Checker and Status Manager.

The bundled workflow uses workflow-scoped `Provider + Invoice + Recipient` keys. This requires stable invoice IDs in real input data; generated invoice IDs are useful for testing but should not be the only production duplicate-prevention identity.


## Execution logging and writeback boundary

Status Manager is the final normalization boundary for observability. It emits `management.executionLog` for audit/event sinks and `management.statusWriteback` for downstream UPSERT-style status updates. The bundled workflow now wires that payload to explicit built-in n8n nodes: `Prepare Status Writeback Row` and `Google Sheets - Status Writeback`.

This preserves the frozen eight-node custom package boundary: writeback is workflow configuration, not hidden node-side I/O. The Sheet branch must be configured with a private status Sheet ID, a Google Sheets credential, and an `invoice_results` tab whose first column is `writeback_key`.

## n8n dry-run validation boundary

The Step 07 validation package under `examples/n8n_dry_run_validation/` is a repository asset for the first real n8n import/run test. It validates editor import, custom-node availability, private Sheet reads, conditional routing, guarded blocking, idempotency metadata, execution-log payloads, and status-writeback payloads while Invoice Sender remains in Dry Run mode. It does not create provider invoices and does not replace provider sandbox testing.

The bundled workflow now defaults Provider Selector `environmentFilter` to `sandbox` to make the first imported workflow execution align with the dry-run validation package. Live routing requires an explicit human configuration change after sandbox approval.


## Step 08 request/response adapter boundary

The provider adapter boundary remains inside the frozen Request Builder -> Invoice Sender -> Status Checker path.

- `ProviderRegistry` builds the provider-specific body/query, fallback response paths, request-mapping metadata, and response-policy metadata.
- `Request Builder` attaches `readyRequest.requestMapping` and `readyRequest.responsePolicy` without executing HTTP.
- `Invoice Sender` validates the final interpolated live request for unresolved URL/header/query/body tokens before provider transport.
- `Invoice Sender` uses response-policy success status codes when setting transport success.
- `Status Checker` supports fallback response path arrays and carries policy retry hints into `standardStatus`.
- `Status Manager` uses retry-policy hints while preserving existing retry/cooldown behavior.

This step does not add another node, does not change the provider Sheet source-of-truth role, and does not perform external writeback.

## Step 10 retry/error classification boundary

Status Checker is the canonical classifier for provider-neutral retry/error metadata. It attaches `errorClassification`, `retryDecision`, `retryAfterSeconds`, and `retryDelayHintSeconds` to `standardStatus`. Status Manager consumes those fields to schedule retries only when the request is safe to retry, applies provider retry-after hints when enabled, caps the final delay, and carries the decision into execution logs, status writeback rows, alerts, and retry queue entries.

Validation, authentication, authorization, not-found, and unresolved conflict errors are treated as review-required failures rather than automatic retry candidates. Rate-limit, timeout, network, policy-marked retryable, and provider 5xx responses can be retried within the configured retry limit and delay cap.



## Step 11 sandbox/live activation boundary

Invoice Sender now owns an explicit activation-stage gate in addition to Dry Run, sendGuard, provider validation, idempotency, and duplicate prevention. The bundled workflow defaults to `dryRunValidation` with expected environment `sandbox`, blank sandbox confirmation, and blank live confirmation.

Promotion must be sequential: dry-run validation -> sandbox real send -> live real send. Sandbox real sends require `Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES`; live real sends require `Live Mode Confirmation = SEND_REAL_INVOICES`. Activation metadata is carried from raw execution to standard status, execution logs, and status writeback rows for later forensic review.

## Step 11B/11C icon/card wiring boundary

Step 11B adds visual runtime metadata only. Each custom node description now points to a branded SVG icon using `file:invoice-router-*.svg`; the build copies those icons into `dist` beside the compiled node files. No node count, data flow, provider behavior, retry behavior, activation safety behavior, or workflow business logic changes were made.

Step 11C replaces the initial minimal icons with polished, hand-authored SVG interpretations of the existing Version 1.0 node-card visual language: rounded purple cards, side connector dots, bottom status pills, and node-specific invoice/provider/status symbols. The SVG icons intentionally contain no text initials or font-dependent glyphs.

The existing `assets/node-cards/v1.0/` PNGs remain documentation/design assets. n8n runtime node cards use the packaged SVG icons from the compiled node folders.

## Step 11D Bulk Run Safety

Bulk sending remains item-stream based: multiple Email List rows flow through the single Request Builder, Invoice Sender, Status Checker, and Status Manager lane. Invoice Sender now enforces run-level bulk gates before and during real HTTP sends:

- maximum invoices per execution
- uniform sandbox/live environment requirement
- optional delay between real sends
- failed-send abort threshold
- critical-error abort for credential, activation, guard, validation, authentication, and authorization problems
- additional sandbox/live bulk confirmation phrases for multi-item real sends

Status Manager now exposes `management.bulkSummary` and includes bulk safety metadata in execution log and status writeback output.

## Step 11E - Production Preset and Retry Loop

Invoice Sender now performs a production preset self-check before transport. The check prevents UI reset or accidental parameter edits from weakening dry-run, sandbox, or live activation safety. The production workflow also includes a guarded automatic retry branch from Status Manager through a built-in Code node and Wait node back into Invoice Sender. Retry attempts remain subject to send guard, activation safety, duplicate prevention, bulk safety, provider retry classification, and lifecycle checkpoint validation. Post/email retries resume the existing provider invoice instead of recreating it.

## Step 12B - n8n Registry/UI Install Compatibility

Step 12B changes only release/discovery metadata and n8n editor searchability. The internal node type keys, eight-node topology, workflow business logic, provider mapping, activation safety, bulk safety, and retry behavior remain unchanged.

The published package is intended to be installed from npm through the n8n Community Nodes UI. To support that path, package metadata keeps the required n8n community-node keyword and compiled `n8n.nodes` manifest, removes the runtime `n8n-workflow` peer dependency risk, and ships a diagnostic script for fallback manual installs.

All custom node display names are prefixed with `InvoiceRouter` so users can find the node family from the n8n editor search. Existing workflow node instance names can remain short because n8n resolves custom node types by their package/type key, not by the visible display label.
## v2.0.0 release-hardening layer

The master lifecycle layer writes customer, invoice, post, and email-send status into the same status writeback contract. Provider template packs are validated through a public manifest, and `project/` remains a private, ignored planning area.



## Step 14D / v2.0.0 Declarative Provider Recipe Runtime

Added a declarative HTTP provider recipe runtime so compatible REST/JSON invoice providers can define customer, invoice, post/finalize, and email-send steps in provider recipe JSON instead of requiring core node code changes. This is intended for compatible providers; non-standard OAuth, webhook, UI-only, or SDK-only flows may still require a dedicated adapter.

## v2 email evidence boundary

Odoo invoice email execution is a provider lifecycle stage, not a successful HTTP-call assumption. The built-in adapter creates and executes `account.move.send.wizard`, then inspects provider-side mail/PDF evidence. Status Checker preserves `QUEUED`, `SENT`, `FAILED`, and `UNVERIFIED` as distinct outcomes. Inbox delivery is outside the provider transport status and remains a live-canary proof item.

The evidence boundary is execution-specific. Invoice Sender captures a readable pre-send message baseline, identifies newly created post-send message IDs, and restricts notification/mail queries to those IDs. If that binding cannot be established, historical evidence is excluded and the lifecycle remains `UNVERIFIED`. Status metadata keeps `emailSendRequested` as a boolean through writeback preparation.

The evidence fields are additive to the existing writeback contract:

```text
email_evidence
lifecycle_outcome
lifecycle_failed_step
lifecycle_checkpoint
retry_resume_stage
retry_resume
```

## v2 lifecycle-resume boundary

Status Manager is the only component that may approve a stage resume. Invoice Sender validates the source, request/provider identity, recognized stage, and existing provider invoice checkpoint before post-only or send-only execution. A fabricated or incomplete resume object is rejected. `EMAIL_UNVERIFIED` is manual-review only.

## Release synchronization boundary

The GitHub install bundle contains the npm tarball, v2 master and compatibility workflows, the Odoo mode pack, common status-writeback assets, and synchronized user/developer/troubleshooting documentation. Release staging is audited before the tarball is added to the bundle. Final publication remains blocked until a complete-project forensic audit passes. Community-node update precedes the one-recipient live canary.


## Phase 05 exactly-once operation envelope
The canonical Odoo workflow writes `PROVIDER_PENDING` before any provider side effect, updates the same `Operation_ID` with result/checkpoint/evidence, then completes ordered Sheet writeback. Recipient identity is `Row_ID`; provider-row identity is `Profile_ID`.

## Phase 06 monotonic reporting boundary

The campaign lease serializes report mutation for one `Campaign_ID`. Status Manager emits a candidate aggregate containing a base revision and the next revision. Before `Google Sheets - Campaign Report` or `Google Sheets - Account Report`, the workflow performs a fresh read and a compare step:

```text
report candidate
-> fresh Sheet read
-> require current Revision == Base_Revision
-> require candidate Revision == Base_Revision + 1
-> require campaign writer owns active Run_ID
-> appendOrUpdate
```

`Build Durable Work Items` chooses the highest-revision row when duplicate report rows exist. Campaign counts are reconstructed from `email_list`, `invoice_results`, and `retry_queue`; process memory and an older aggregate row cannot preserve an obsolete maximum. `RuntimeStore.updateCampaignAccountStats` treats a new-run Sheet seed as authoritative and advances the account revision monotonically.

Writeback repair compares report payload revisions against the startup Sheet snapshot. An already-applied or older payload is a no-op and can complete the repair envelope; a revision gap blocks instead of overwriting. Odoo issuer-group failures branch from Provider Loader into revisioned `account_report` rows under the `PREFLIGHT` campaign namespace. This reporting branch cannot enter Provider Selector or Invoice Sender.

## Phase 07 release verification boundary

Phase 07 adds verification assets without changing the frozen eight-node runtime architecture. A dry-run-only workflow fixture is executed through exactly n8n 2.31.6 in an isolated custom-extension root, and the complete canonical workflow is imported/exported through the same engine. The separate-process regression uses a 66-second resume marker to prove provider-pool and secret-vault reconstruction across different processes; it does not impersonate n8n database wait/resume. Actual restart/other-worker behavior remains a reviewed pilot requirement. Odoo 18 and 19 fixture pipelines share the canonical capability manifest and verify evidence-backed send/PDF results through Status Manager.

The final release gate consumes sanitized engine, canary, and pilot evidence. Live evidence remains external to runtime correctness: canary/pilot records must be reviewed and cannot be generated as `PASS` by static tests.


## v2.1.1 Final corrective forensic audit

The canonical production workflow now contains 126 nodes and 141 edges while retaining exactly eight exported InvoiceRouter custom nodes. Immediately before each provider operation, Request Builder is followed by a fresh `campaign_report` lease read and fail-closed Run_ID/expiry verification. Only then is the exact built stable reference persisted in the `PROVIDER_PENDING` operation envelope.

On startup, an unresolved `PROVIDER_PENDING` row is reconstructed as `operationRecovery`. Email List preserves its stable reference, Request Builder reuses that reference, and Invoice Sender enters reconciliation mode before any invoice creation. A recovered posted invoice without trusted email checkpoint becomes `UNVERIFIED`/manual review rather than an automatic resend.

The exact-engine harness invokes npm through Node's `npm_execpath`, imports/exports the complete 126-node canonical workflow, and records package/workflow/log hashes. Final canary and pilot evidence is cryptographically bound to that engine-tested tarball and canonical workflow. Tag releases validate npm credentials before GitHub release creation.

## Final corrective Row_ID bootstrap

`Google Sheets - Email List` supplies n8n's virtual `row_number`. Email List preserves it as `job.sourceRow`; `Prepare Job Identity Row` fails closed if it is missing; and `Google Sheets - Persist Job Identity` updates that exact row. Once persisted, all recipient lifecycle writes use `Row_ID`.

Phase 07 evidence binding is deterministic across Windows and CI: package file contents, canonical workflow, fixture, exact n8n version, custom-node count, and imported topology form `engineBindingSha256`. Runtime timestamps remain audit metadata and do not participate in cross-run identity.

Cross-platform artifact determinism is completed by repository-wide LF text checkout and TypeScript `newLine: "lf"`. Package-content hashing therefore compares stable bytes rather than platform-specific line endings.

The final evidence boundary resolves supporting artifact paths below `evidence/phase07/artifacts/`, validates actual file hashes and scans allowed text artifacts before release approval.
