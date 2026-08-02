# InvoiceRouter for n8n

[![InvoiceRouter CI](https://github.com/vibtools/n8n-nodes-invoicerouter/actions/workflows/ci.yml/badge.svg)](https://github.com/vibtools/n8n-nodes-invoicerouter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/n8n-nodes-invoicerouter.svg)](https://www.npmjs.com/package/n8n-nodes-invoicerouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

InvoiceRouter is an eight-node n8n community-node package for loading many provider accounts from Google Sheets, assigning accounts safely, personalizing invoice data, executing provider requests, standardizing results, and creating retry/metrics/alert/audit events.

**Package version:** `1.5.0`  
**Architecture:** Version 1.0 Final Freeze  
**Implementation:** Complete — 8/8 custom nodes registered; v1.5.0 hardened release identity


## v1.5.0 release identity

`v1.5.0` is the hardened release identity for the Step 01-11E production-readiness series. It keeps the frozen eight custom-node topology and adds the release-level documentation, packaging identity, and live-acceptance runbook needed before GitHub/npm publication.

Major v1.5.0 capabilities:

- conditional provider/action/environment routing for bulk invoice rows;
- strict provider-specific validation before transport;
- send guard, dry-run validation, sandbox real-send, and live real-send activation gates;
- idempotency and duplicate-send prevention for real invoice transport;
- provider request/response mapping with unresolved-token blocking;
- retry/error classification, provider `Retry-After` handling, and guarded retry workflow wiring;
- execution logging, status writeback payloads, and Google Sheets writeback branch;
- bulk run safety controls for item caps, uniform environment, delay, failed-send abort, and bulk confirmation phrases;
- production preset self-check to block accidental unsafe UI reset/config edits;
- polished SVG node icons packaged beside the compiled n8n node files.

Release boundary: `v1.5.0` is **build/install/live-test ready**. Final production approval still requires running the included n8n dry-run, sandbox API send, retry/writeback, and live canary acceptance checks in your own self-hosted n8n instance with private provider credentials.

See [`docs/freeze/v1.0/V1_5_0_BUILD_INSTALL_LIVE_TEST_RUNBOOK.md`](docs/freeze/v1.0/V1_5_0_BUILD_INSTALL_LIVE_TEST_RUNBOOK.md) for the master build, install, sandbox, live canary, evidence, rollback, and publish checklist.



## n8n registry/UI install compatibility

Step 12B hardens the package for npm registry publication and n8n Community Nodes UI installation. The package keeps the npm identity `n8n-nodes-invoicerouter@1.5.0`, keeps `n8n-community-node-package` in keywords, removes the install-time `n8n-workflow` peer dependency risk, and ships a diagnostic script for manual fallback installs.

The n8n editor display names are now prefixed for searchability:

| Search term | Nodes shown |
|---|---|
| `InvoiceRouter` | all eight custom nodes |
| `InvoiceRouter Invoice Sender` | sender node |
| `InvoiceRouter Request Builder` | request builder node |
| `InvoiceRouter Provider Loader` | provider loader node |

Preferred production install path after npm publish:

```text
n8n Community Nodes UI -> install package: n8n-nodes-invoicerouter
```

Manual `.tgz` install remains a fallback only. If used, run the packaged diagnostic from the same n8n runtime/container after installation:

```bash
node ~/.n8n/nodes/node_modules/n8n-nodes-invoicerouter/scripts/diagnose-n8n-package.mjs ~/.n8n/nodes/node_modules/n8n-nodes-invoicerouter
```

See [`docs/freeze/v1.0/N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md`](docs/freeze/v1.0/N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md).

## Final workflow diagram

![InvoiceRouter Version 1 architecture](assets/architecture/invoice-router-architecture-v1.0.png)

```text
Manual Trigger
  ├─> Google Sheets: Provider Accounts/Credentials -> Provider Loader ─┐
  ├─> Google Sheets: Email List -> Email List -------------------------┼─> Provider Selector
  └─> Invoice Template ------------------------------------------------┘

Provider Selector allocation ----\
Invoice Template -------------------> Request Builder
One normalized recipient ---------/

Request Builder -> Invoice Sender -> Status Checker -> Status Manager
                                                       ├─ workflow result
                                                       ├─ retry queue event
                                                       ├─ metrics/analytics events
                                                       ├─ alert/audit events
                                                       ├─ provider feedback/state update
                                                       └─ Prepare Status Writeback Row -> Google Sheets: invoice_results
```

The importable workflow is included at:

```text
workflows/InvoiceRouter-v1-production.json
```

## Custom nodes

| # | Node | Responsibility |
|---|---|---|
| 1 | **InvoiceRouter Provider Loader** | Validates Google Sheets provider rows, creates the frozen `providers[]` structure, stores runtime secrets in an in-process vault, and masks visible credentials. |
| 2 | **InvoiceRouter Provider Selector** | Maintains provider state, selects an eligible account, applies rate limits/circuit-breaker rules, and creates lock metadata. |
| 3 | **InvoiceRouter Invoice Template** | Builds fixed invoice fields, repeatable line items, totals, payment terms, custom fields, and dynamic tag definitions. |
| 4 | **InvoiceRouter Email List** | Validates recipients, removes duplicate emails, generates missing names, preserves custom columns, and reserves each email once per batch. |
| 5 | **InvoiceRouter Request Builder** | Merges exactly one account + one template + one recipient, resolves dynamic tags, applies provider presets, validates send readiness, and creates one idempotent ready request. |
| 6 | **InvoiceRouter Invoice Sender** | Resolves the runtime credential, enforces guard/duplicate prevention, executes exactly one HTTP request when allowed, measures latency/size, and returns a redacted raw result. |
| 7 | **InvoiceRouter Status Checker** | Analyzes the raw response, classifies errors, extracts invoice metadata, and emits a standard status object. |
| 8 | **InvoiceRouter Status Manager** | Applies retry policy, emits management events, determines the final workflow state, updates provider feedback, and emits normalized execution-log/writeback payloads. |

`Manual Trigger` and `Google Sheets` are built-in n8n nodes and are not part of this package.

## n8n node icons and cards

All eight custom InvoiceRouter nodes declare polished SVG runtime icons through n8n's `description.icon` field. The build copies each SVG into the matching `dist/nodes/<node-folder>/` directory so the packaged node card in the n8n editor can resolve its icon beside the compiled node file.

The runtime SVGs are hand-authored vector interpretations of the existing Version 1.0 node-card motif: purple rounded cards, side connector dots, bottom status pills, and node-specific invoice/provider/status symbols. They intentionally avoid text initials so the n8n node list does not depend on font rendering.

The larger PNG files under `assets/node-cards/v1.0/` remain repository design/documentation assets and are intentionally not shipped through npm to avoid unnecessary package-size growth. See [`docs/freeze/v1.0/NODE_ICON_CARD_WIRING.md`](docs/freeze/v1.0/NODE_ICON_CARD_WIRING.md).

## Request Builder input order

Request Builder deliberately performs the merge; no extra custom Merge node exists.

| Input | Source | Data |
|---|---|---|
| Input 1 | Provider Selector | Allocated provider/account profile |
| Input 2 | Invoice Template | Standard invoice template |
| Input 3 | Email List | One normalized recipient per item |

The production workflow JSON already wires these inputs correctly.

## Provider workbook

The Version 1 reference workbook is:

```text
examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx
```

This workbook is a **demo/reference preset workbook**, not a ready-to-send production credential source. Use it to understand the 18-column provider contract, supported provider names, supported actions, endpoint examples, and where provider-specific values belong. Before any real run, copy the workbook to a private Google Sheet and replace demo values with one verified provider/account/action/environment profile at a time.

Important separation rules:

- Demo rows and example conditional notes are not runtime approvals.
- Real routing conditions must be configured in **Provider Selector → Conditional Routing** or through explicit n8n IF/Switch nodes.
- The bundled production workflow now blocks unrouted items by default.
- Real credentials, customer IDs, organization IDs, tenant IDs, endpoints, and tokens must never be committed to the repository.
- Leave **Invoice Sender → Dry Run** enabled until the selected provider profile passes a sandbox execution and sendGuard output is reviewed.

It contains 20 action rows across 19 provider names:

- Stripe
- Paddle
- Polar
- LemonSqueezy
- Invoice Ninja
- Zoho Books
- Xero
- ERPNext
- Odoo
- QuickBooks
- FreshBooks
- Chargebee
- Recurly
- Square
- PayPal
- Braintree
- Razorpay
- Bill.com
- Custom REST

The built-in provider registry normalizes these names and provides request/response mapping presets. Some providers require provider-specific IDs such as `customer_id`, `organization_id`, `realmId`, `contact_id`, or `location_id`. Put those values in recipient/template custom fields or in the Sheet's **Extra Value** field where the endpoint uses a placeholder.

### Provider-specific strict validation

The bundled workflow enables **Request Builder → Strict Provider Validation**. Request Builder now rejects a prepared request before Invoice Sender when required invoice, profile, or provider fields are missing. In audit mode, the same issues are also attached to `readyRequest.providerValidation.errors` and make `sendGuard.approved = false`, so **Invoice Sender → Require Send Guard** blocks live transport.

Provider-specific values should be supplied through Invoice Template custom fields, preserved Email List custom columns, or an explicit Custom Body Override where appropriate. Common examples:

| Provider | Required custom fields checked before send |
|---|---|
| Stripe | `customer_id` |
| Paddle | `price_id` or line-specific `price_id_*` |
| LemonSqueezy | `store_id`, `variant_id` |
| Invoice Ninja | `client_id` |
| Zoho Books | `customer_id`, `organization_id` |
| Xero | `contact_id` or `contact_number` |
| ERPNext | `customer`, `item_code` or line-specific `item_code_*` |
| Odoo | `database`, `uid`, `password`, `partner_id` |
| QuickBooks | `customer_id`, `item_id` or line-specific `item_id_*` |
| FreshBooks / Chargebee | `customer_id` |
| Recurly | `account_code` |
| Square | `location_id`, `order_id`, `customer_id` |
| Braintree | `payment_method_id` |
| Razorpay | `customer_id` or `contact_id` |

Custom REST keeps the generic envelope and depends on your chosen endpoint contract.

## Dynamic invoice tags

Invoice Template and Request Builder support:

| Tag | Generated value |
|---|---|
| `#INV#` | Deterministic invoice code per provider/recipient/request |
| `#TRX#` | Deterministic transaction code |
| `#RANDOM#` | 13-character deterministic random-style code |
| `#EMAIL#` | Recipient email |
| `#NAME#` | Recipient name |
| `#PROVIDER#` | Selected provider ID |
| `#ACCOUNT#` | Selected account ID |

The same request seed always produces the same tag values, which helps idempotency and retry safety.

## Idempotency and duplicate-send prevention

Request Builder now emits a structured `readyRequest.idempotency` object. The bundled production workflow sets **Idempotency Key Mode** to `Provider + Invoice + Recipient` and **Idempotency Scope** to `Workflow`, so the live-send key is derived from provider, profile, action, environment, invoice ID, and recipient email.

Invoice Sender keeps **Prevent Duplicate Sends** enabled in the bundled workflow. In live mode it reserves the idempotency key before HTTP transport, persists a bounded `invoiceRouterIdempotency` history in workflow static data when available, and blocks later live sends with the same active key as `DUPLICATE`. Dry Run does not reserve keys.

Production rule: real invoice rows must use a stable invoice ID. If the invoice ID is regenerated on every execution, duplicate prevention can only protect copied/replayed ready requests inside the active retention window for the generated key.

Default retention settings in the production workflow:

| Setting | Default | Purpose |
|---|---|---|
| `preventDuplicateSends` | `true` | Block repeated live sends for an active idempotency key. |
| `duplicateTtlHours` | `720` | Retain successful live-send keys for 30 days. |
| `reservationTtlMinutes` | `15` | Block concurrent in-flight sends if an execution stalls before completion. |

## Execution logging and status writeback

Status Manager now emits two hardened payloads for every item:

| Payload | Purpose |
|---|---|
| `management.executionLog` | Normalized audit/event record containing workflow, execution, provider, recipient, transport, retry, error, and timing fields. |
| `management.statusWriteback` | Normalized `UPSERT` payload for downstream Google Sheets, database, webhook, or API writeback nodes. |

The bundled workflow keeps **Include Execution Log** and **Include Status Writeback** enabled. It uses **Writeback Key Mode = Idempotency Key** and **Writeback Target = invoice_results**.

Step 09 wires the status writeback payload through explicit built-in n8n nodes:

```text
Status Manager -> Prepare Status Writeback Row -> Google Sheets - Status Writeback
```

The Code node flattens `management.statusWriteback.values` into row columns and the Google Sheets node uses `appendOrUpdate` with `writeback_key` as the matching column. Replace `REPLACE_STATUS_SPREADSHEET_ID` and the placeholder Google Sheets credential before running this branch.

Optional **Persist Execution Log** stores a capped `invoiceRouterExecutionLog` array in workflow static data for local troubleshooting. Keep it disabled unless you accept n8n static-data retention for invoice metadata. For production reporting, use the wired status writeback branch with an access-controlled private Sheet or replace that branch with an approved database/API write node.

Detailed wiring requirements are documented in [`docs/freeze/v1.0/STATUS_WRITEBACK_WIRING.md`](docs/freeze/v1.0/STATUS_WRITEBACK_WIRING.md).


## Provider request/response mapping hardening

Request Builder now attaches `readyRequest.requestMapping` and `readyRequest.responsePolicy` to every prepared request. These metadata blocks document the provider adapter family, canonical action, method/content-type hints, idempotency header hint, success status codes, retryable status codes, non-retryable status codes, and response parsing strategy.

Status Checker supports fallback response path arrays, so provider invoice ID, invoice number, status, URLs, transaction IDs, and error details can be extracted from common response envelopes such as `id`, `invoice.id`, or `data.id` without a second provider API call.

Invoice Sender also blocks live transport if the final interpolated URL, headers, query, or body still contains unresolved template tokens such as `{realmId}` or `{{ACCESS_TOKEN}}`. Dry Run remains safe and reports unresolved tokens in `rawExecution.requestPreview.unresolvedTokens` for review.

The detailed Step 08 contract is documented in [`docs/freeze/v1.0/PROVIDER_REQUEST_RESPONSE_MAPPING.md`](docs/freeze/v1.0/PROVIDER_REQUEST_RESPONSE_MAPPING.md).

## Real n8n Dry Run validation package

Step 07 adds a dedicated import/run validation package for the first real n8n editor execution:

```text
examples/n8n_dry_run_validation/
```

Use this package only with **Invoice Sender → Dry Run** enabled. It contains a safe Custom REST provider CSV, recipient rows that exercise routed/blocked/invalid/duplicate paths, expected outcomes, and a status-writeback column reference. The provider host is intentionally `dry-run.invalid.local`; it is not a sandbox API endpoint and must not be used with Dry Run disabled.

For the first imported workflow test, set:

| Setting | Required value |
|---|---|
| `Provider Selector → Environment Filter` | `sandbox` |
| `Invoice Sender → Dry Run` | `true` |
| `Invoice Sender → Live Mode Confirmation` | empty |

Then follow [`docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md`](docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md). This validation proves import, Sheet reads, conditional routing, guarded blocking, idempotency metadata, execution logging, and status-writeback payload generation. It does not approve a provider sandbox send or a live invoice send.

## Processing modes

Provider Selector offers two modes plus optional per-item conditional routing:

### Conditional routing

Provider Selector can also route each recipient through conditional routing before it allocates an account. It evaluates optional **Routing Rules JSON** first, then falls back to per-recipient fields such as:

| Email List column | Runtime path | Purpose |
|---|---|---|
| `Provider` | `recipient.customFields.Provider` | Selects the provider profile, for example `Stripe` or `Custom`. |
| `Action` | `recipient.customFields.Action` | Selects the account/action profile, for example `Create Invoice`. |
| `Environment` | `recipient.customFields.Environment` | Selects `sandbox` or `live`. |

When **Require Conditional Match** is enabled, any recipient without a matching rule or routing fields is returned as `BLOCKED`; Request Builder and Invoice Sender will not create or send an HTTP request for that item.

### Sequential — default

Best for Version 1 and beginners. Multiple recipients may reuse the same account because Invoice Sender processes items in order. This is the default in the bundled workflow.

### Parallel locks

Keeps each account locked until Status Manager feedback. Use this only when running controlled parallel workers with enough provider accounts. Unavailable work items are marked `QUEUED` rather than being sent with the wrong account.

## Credential model and security boundary

Version 1 intentionally stores provider API keys/secrets in Google Sheets so many changing accounts can be managed without editing n8n credentials individually.

Provider Loader:

- reads the Sheet row received from the built-in Google Sheets node;
- stores real credential material only in the active InvoiceRouter runtime vault;
- outputs masked previews and a credential reference;
- never sends credentials through Request Builder output;
- lets Invoice Sender inject the secret only at HTTP execution time;
- redacts secrets from normal response/error output.

Important boundary: the built-in Google Sheets node receives the original row before Provider Loader runs. In production:

1. Keep the spreadsheet private and use least-privilege Google access.
2. Do not commit real credentials to GitHub.
3. Disable or minimize successful execution-data retention in n8n.
4. Restrict access to workflow executions and logs.
5. Rotate credentials with awareness that Google Sheet revision history may retain previous values.
6. Start with **Dry Run** enabled and test provider sandboxes before live use.

## Install from source

Use Node.js 24 for the supported build environment.

```bash
npm ci
npm run verify
npm pack
```

For a typical self-hosted n8n installation:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install /absolute/path/n8n-nodes-invoicerouter-1.5.0.tgz
```

Restart n8n after installation.

## Import and configure the workflow

`workflows/InvoiceRouter-v1-production.json` is a production-shaped template. It is intentionally inactive, uses placeholder spreadsheet and credential IDs, and keeps **Invoice Sender → Dry Run** enabled.

1. Import `workflows/InvoiceRouter-v1-production.json` in n8n.
2. Copy the reference workbook into a private Google Sheet.
3. Keep only the provider rows you are actively testing enabled.
4. Replace every demo value required by that provider/action/environment.
5. Open **Google Sheets - Provider Accounts** and replace the provider spreadsheet ID.
6. Open **Google Sheets - Email List** and replace the recipient spreadsheet ID.
7. Select your Google Sheets OAuth2 or Service Account credential.
8. Configure Provider Selector deliberately:
   - keep `environmentFilter` explicit; the bundled workflow defaults to `sandbox` for Dry Run validation, and `live` must be selected only after sandbox approval;
   - either use static `providerFilter`/`actionFilter` during single-provider onboarding, or use Conditional Routing with recipient columns/rules;
   - the bundled workflow enables Conditional Routing and **Require Conditional Match**, so missing routes become `BLOCKED`.
9. Keep **Request Builder → Send Guard Mode** set to `Strict`.
10. Keep **Request Builder → Idempotency Key Mode** set to `Provider + Invoice + Recipient` unless a reviewed provider-specific reason requires a narrower key.
11. Keep **Invoice Sender → Require Send Guard** enabled.
12. Keep **Invoice Sender → Prevent Duplicate Sends** enabled.
13. Keep **Status Manager → Respect Provider Retry-After** enabled and **Retry Max Delay** capped for production safety.
14. Keep **Invoice Sender → Dry Run** enabled.
15. For the first import/run test, use `examples/n8n_dry_run_validation/` and confirm the expected outcomes in `expected-dry-run-outcomes.json`.
16. Execute the workflow manually and inspect Provider Loader, Provider Selector, Request Builder, Invoice Sender, Status Checker, and Status Manager output.
17. Configure required provider-specific IDs through custom fields or the Sheet's **Extra Value** field.
18. Confirm the invoice ID strategy is stable enough for duplicate prevention.
19. Keep Invoice Sender **Activation Safety Mode** on `dryRunValidation` until the n8n dry-run validation package passes.
20. For a real provider sandbox send, set Activation Safety Mode to `sandboxRealSend`, disable Dry Run, keep routing on `sandbox`, and enter `SEND_SANDBOX_INVOICES`.
21. For a real provider live send, set Activation Safety Mode to `liveRealSend`, route only `live` rows, and enter `SEND_REAL_INVOICES` only after sandbox evidence is accepted.
22. Activate a scheduled/webhook copy only after the manual workflow is stable.

A real invoice-send run is not approved until all setup gates in [`docs/freeze/v1.0/PRODUCTION_SETUP_CHECKLIST.md`](docs/freeze/v1.0/PRODUCTION_SETUP_CHECKLIST.md) are complete.

## Standard runtime objects

The main internal contracts are:

```text
Provider Loader  -> providers[]
Provider Selector -> providerAllocation
Invoice Template -> invoiceTemplate
Email List       -> recipient
Request Builder  -> readyRequest
Invoice Sender   -> rawExecution
Status Checker   -> standardStatus
Status Manager   -> management
```

Normal outputs contain no plain API key or API secret.

## Validation and tests

```bash
npm run validate
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
npm pack --dry-run
```

The test suite verifies:

- 8/8 n8n node registration;
- production workflow wiring;
- Sheet credential masking;
- recipient validation/deduplication;
- invoice totals and dynamic tags;
- three-input Request Builder merging;
- secret injection only at HTTP execution;
- status normalization;
- success completion and retry scheduling;
- production dry-run gate defaults;
- execution-log/status-writeback output contracts;
- provider request/response mapping metadata;
- retry/error classification and provider retry-after handling;
- sandbox/live activation safety gates;
- bulk run safety controls;
- production preset self-check;
- automatic retry workflow wiring;
- packaged runtime SVG icons.

## Production scope

The package is production-oriented as a **configurable routing/runtime framework**. Provider APIs still differ in mandatory IDs, OAuth token lifecycle, multi-step invoice creation, and account-specific rules. The bundled presets provide request/response structures and clear warnings, but live provider onboarding must be verified against that provider's sandbox and account configuration.

The included workflow and workbook are therefore **not a one-click live invoice sender**. They become real-run ready only after private Sheet replacement, explicit Provider Selector filters or conditional routing rules, provider-specific required values, sendGuard review, sandbox verification, and the manual Dry Run review are complete.

Version 1 runtime state is process-local, with best-effort workflow static feedback. For multi-process n8n queue deployments, use sequential mode per worker or introduce an external state backend in a later freeze version before sharing one account pool across processes.

## Source of truth

Read these files in order:

1. [`VERSION_1_0_FREEZE.md`](VERSION_1_0_FREEZE.md)
2. [`docs/freeze/v1.0/FINAL_ARCHITECTURE.md`](docs/freeze/v1.0/FINAL_ARCHITECTURE.md)
3. [`docs/freeze/v1.0/NODE_CONTRACTS.md`](docs/freeze/v1.0/NODE_CONTRACTS.md)
4. [`docs/freeze/v1.0/PROVIDER_SHEET_CONTRACT.md`](docs/freeze/v1.0/PROVIDER_SHEET_CONTRACT.md)
5. [`docs/freeze/v1.0/SECURITY_DECISION.md`](docs/freeze/v1.0/SECURITY_DECISION.md)
6. [`docs/freeze/v1.0/PRODUCTION_SETUP_CHECKLIST.md`](docs/freeze/v1.0/PRODUCTION_SETUP_CHECKLIST.md)
7. [`docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md`](docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md)
8. [`docs/freeze/v1.0/STATUS_WRITEBACK_WIRING.md`](docs/freeze/v1.0/STATUS_WRITEBACK_WIRING.md)
9. [`docs/freeze/v1.0/PROVIDER_REQUEST_RESPONSE_MAPPING.md`](docs/freeze/v1.0/PROVIDER_REQUEST_RESPONSE_MAPPING.md)
10. [`docs/freeze/v1.0/RETRY_ERROR_CLASSIFICATION.md`](docs/freeze/v1.0/RETRY_ERROR_CLASSIFICATION.md)
11. [`docs/freeze/v1.0/SANDBOX_LIVE_ACTIVATION.md`](docs/freeze/v1.0/SANDBOX_LIVE_ACTIVATION.md)
12. [`docs/freeze/v1.0/N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md`](docs/freeze/v1.0/N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md)

## License

MIT

## Bulk run safety

The production workflow supports bulk invoice sending through n8n item processing. Each Email List row becomes one guarded invoice request. The workflow intentionally keeps one Request Builder and one Invoice Sender lane so duplicate prevention, activation safety, retry classification, and status writeback remain centralized.

Invoice Sender includes bulk controls for maximum invoices per execution, uniform sandbox/live environment enforcement, optional throttling, failed-send aborts, critical-error aborts, and separate sandbox/live bulk confirmation phrases. The production template enables bulk safety by default and caps the first production template at 100 invoices per execution.

For sandbox bulk real send, use `SEND_SANDBOX_INVOICES` plus `SEND_BULK_SANDBOX_INVOICES`. For live bulk real send, use `SEND_REAL_INVOICES` plus `SEND_BULK_REAL_INVOICES` only after final audit and sandbox evidence.

### Step 11E production preset self-check and retry wiring

The production workflow now includes a guarded retry loop and a runtime preset self-check. The default workflow remains dry-run safe with `Production Preset Self-Check = Dry Run Validation`. Retryable provider failures can flow from Status Manager to Prepare Retry Request, Wait Before Retry, and back to Invoice Sender. Non-retryable validation/auth/resource errors remain blocked for manual review.
