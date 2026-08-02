# InvoiceRouter v1.5.0 Master Build, Install, Sandbox, Live Test, and Publish Runbook

This runbook is the operational release document for `n8n-nodes-invoicerouter@1.5.0`.

It covers the exact sequence required to move from the clean source package to a controlled self-hosted n8n install, dry-run validation, provider sandbox API sending, retry/writeback verification, one-row live canary sending, and final GitHub/npm publication.

## Release boundary

`v1.5.0` is the hardened release identity for the frozen eight-node InvoiceRouter architecture.

It is **build/install/live-test ready**. It is not considered fully production-approved until your own n8n instance produces the evidence listed in this runbook.

Never skip directly from local `npm run verify` to live bulk sending. The required ladder is:

```text
local verify -> npm pack -> n8n install -> imported workflow dry-run -> status writeback proof -> sandbox real API send -> retry/writeback proof -> one-row live canary -> controlled live bulk
```

## What v1.5.0 contains

| Area | v1.5.0 status |
|---|---|
| Frozen custom nodes | 8/8 custom nodes |
| Bulk invoice row processing | Item-stream based through one Request Builder/Sender/Checker/Manager lane |
| Conditional provider/action/environment routing | Included |
| Provider-specific strict validation | Included |
| Real HTTP Invoice Sender | Included with activation gates |
| Dry-run validation mode | Included |
| Sandbox real-send mode | Included |
| Live real-send mode | Included |
| Idempotency and duplicate prevention | Included |
| Bulk run safety controls | Included |
| Production preset self-check | Included |
| Retry/error classification | Included |
| Automatic retry workflow wiring | Included structurally |
| Status writeback branch | Included structurally |
| Runtime SVG node icons | Included |
| Final live evidence | Must be produced in your n8n instance |

## Required private assets

Do not commit these to GitHub:

1. Private provider Google Sheet.
2. Private recipient/email Google Sheet.
3. Private status/writeback Google Sheet with an `invoice_results` tab.
4. Google Sheets credential selected inside n8n.
5. Provider sandbox credentials.
6. Provider live credentials.
7. Provider-specific IDs such as customer IDs, organization IDs, tenant IDs, item IDs, contact IDs, location IDs, realm IDs, account codes, partner IDs, database names, or equivalent provider-required values.

## Source build gate

### Windows PowerShell / Command Prompt

```bat
cd /d D:\VibTools_Workspace\16_Workflow\01_InvoiceRouter\dev
npm ci
npm run verify
npm pack
```

Expected result:

```text
Project validation passed. Registered nodes: 8/8. Production workflow: complete.
Formatting check passed.
Project lint passed.
tests 39
pass 39
npm notice filename: n8n-nodes-invoicerouter-1.5.0.tgz
```

### Linux / macOS

```bash
cd /path/to/n8n-nodes-invoicerouter
npm ci
npm run verify
npm pack
```

The generated install artifact must be:

```text
n8n-nodes-invoicerouter-1.5.0.tgz
```

Stop if the generated package is still `1.2.0`.

## Package content gate

Run:

```bash
npm pack --dry-run
```

Confirm the package preview contains:

- `dist/index.js`
- all eight `dist/nodes/**/**/*.node.js` files
- all eight `dist/nodes/**/invoice-router-*.svg` runtime icon files
- `workflows/InvoiceRouter-v1-production.json`
- `examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx`
- `examples/n8n_dry_run_validation/`
- `docs/freeze/v1.0/BULK_RUN_SAFETY.md`
- `docs/freeze/v1.0/SANDBOX_LIVE_ACTIVATION.md`
- `docs/freeze/v1.0/PRODUCTION_PRESET_SELF_CHECK_AND_RETRY_WIRING.md`
- this runbook

The package must not include:

- `.git/`
- `node_modules/`
- raw provider secrets
- private Google Sheets data
- local n8n execution exports with credentials

## Install into self-hosted n8n

Use the install method that matches your deployment.

### Option A — local/manual self-hosted install

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install /absolute/path/to/n8n-nodes-invoicerouter-1.5.0.tgz
```

Restart n8n after installation.

### Option B — Windows manual self-hosted install

Use the Windows user profile n8n nodes folder for your n8n service user. Example:

```bat
mkdir %USERPROFILE%\.n8n\nodes
cd /d %USERPROFILE%\.n8n\nodes
npm install D:\VibTools_Workspace\16_Workflow\01_InvoiceRouter\dev\n8n-nodes-invoicerouter-1.5.0.tgz
```

Restart the n8n process or Windows service.

### Option C — Docker / Docker Compose

Use a persistent n8n data volume and run npm install inside the container or build a custom image that installs the `.tgz`. Do not install into an ephemeral container filesystem that will be lost on restart.

Container example, adjust names/paths:

```bash
docker cp n8n-nodes-invoicerouter-1.5.0.tgz n8n:/tmp/n8n-nodes-invoicerouter-1.5.0.tgz
docker exec -it n8n sh -lc 'mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes && npm install /tmp/n8n-nodes-invoicerouter-1.5.0.tgz'
docker restart n8n
```

## Post-install node availability gate

In the n8n editor, search for all eight custom nodes:

1. Provider Loader
2. Provider Selector
3. Invoice Template
4. Email List
5. Request Builder
6. Invoice Sender
7. Status Checker
8. Status Manager

Also confirm the branded SVG icons appear on the node cards. If a node is missing, stop and do not import the production workflow.

## Workflow import gate

Import:

```text
workflows/InvoiceRouter-v1-production.json
```

Before the first run, confirm:

| Node | Required state |
|---|---|
| Workflow | Inactive |
| Provider Selector | `Environment Filter = sandbox` |
| Provider Selector | Conditional Routing enabled |
| Provider Selector | Require Conditional Match enabled |
| Request Builder | Send Guard Mode = `Strict` |
| Request Builder | Strict Provider Validation = enabled |
| Request Builder | Idempotency Key Mode = `Provider + Invoice + Recipient` |
| Invoice Sender | Dry Run = `true` |
| Invoice Sender | Require Send Guard = enabled |
| Invoice Sender | Prevent Duplicate Sends = enabled |
| Invoice Sender | Activation Safety Mode = `dryRunValidation` |
| Invoice Sender | Expected Request Environment = `sandbox` |
| Invoice Sender | Enable Bulk Run Safety = enabled |
| Invoice Sender | Production Preset Self-Check = `dryRunValidation` |
| Status Manager | Include Execution Log = enabled |
| Status Manager | Include Status Writeback = enabled |

Stop if any real-send confirmation field already contains a confirmation phrase.

## Google Sheets setup

Create three private Sheets or one private spreadsheet with separate tabs.

### Provider sheet

Required tab name:

```text
provider
```

Start from the reference workbook, then keep only the provider/account/action/environment rows you are testing.

For dry-run validation, you may import:

```text
examples/n8n_dry_run_validation/provider-accounts-dry-run.csv
```

For provider sandbox/live tests, replace every placeholder with real provider sandbox/live values.

### Email list sheet

Required tab name:

```text
email_list
```

For dry-run validation, you may import:

```text
examples/n8n_dry_run_validation/email-list-dry-run.csv
```

For real tests, start with exactly one recipient row. Do not begin with bulk live sending.

Recommended columns:

```text
Email, Name, Provider, Action, Environment
```

Add provider-specific columns as needed, for example:

```text
customer_id, organization_id, contact_id, item_id, price_id, location_id, realmId, account_code, database, uid, password
```

### Status writeback sheet

Required tab name:

```text
invoice_results
```

Use the header file:

```text
examples/n8n_dry_run_validation/status-writeback-columns.csv
```

The first column must remain:

```text
writeback_key
```

## Dry-run validation

Keep Invoice Sender in Dry Run mode.

Run the workflow manually.

Expected evidence:

| Node | Evidence |
|---|---|
| Provider Loader | Enabled providers loaded; API secrets masked in visible output |
| Email List | Valid rows normalized; invalid/duplicate rows skipped |
| Provider Selector | Routed rows match provider/action/environment; unrouted rows blocked |
| Invoice Template | Invoice ID, invoice number, totals, due date, and dynamic tags populated |
| Request Builder | `sendGuard.approved = true` only for valid routed rows |
| Invoice Sender | Routed rows return `transportStatus = DRY_RUN`; no provider HTTP call |
| Status Checker | Dry-run is not treated as provider transport failure |
| Status Manager | `management.executionLog`, `management.statusWriteback`, and `management.bulkSummary` exist |
| Google Sheets writeback | `invoice_results` receives or updates result rows |

Stop if any provider dashboard shows a real invoice after dry-run.

## Sandbox real API send

Only after dry-run passes, configure exactly one provider sandbox row and one recipient row.

Required settings:

```text
Provider Selector -> Environment Filter = sandbox
Invoice Sender -> Dry Run = false
Invoice Sender -> Activation Safety Mode = sandboxRealSend
Invoice Sender -> Expected Request Environment = sandbox
Invoice Sender -> Production Preset Self-Check = sandboxRealSend
Invoice Sender -> Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES
```

For multi-item sandbox send, also set:

```text
Invoice Sender -> Sandbox Bulk Confirmation = SEND_BULK_SANDBOX_INVOICES
```

Run one item first.

Pass evidence:

- provider sandbox dashboard/API shows one invoice/request;
- n8n execution shows activation approved for sandbox;
- no live provider account is touched;
- `invoice_results` row includes sandbox activation fields;
- status fields contain provider invoice ID/status/URL if the provider returned them;
- no secrets appear in normal node output.

## Retry and rate-limit validation

Use a sandbox provider/test endpoint that can return a retryable failure or configure a controlled Custom REST sandbox endpoint.

Expected behavior:

1. Status Checker classifies retryable errors such as rate limit, network/timeout, or provider 5xx.
2. `Retry-After` or rate-limit reset headers are parsed when present.
3. Status Manager emits `management.retryScheduled = true` and a retry queue entry.
4. The workflow retry branch prepares a retry request.
5. The Wait node delays the retry.
6. The request returns to Invoice Sender.
7. The retry still passes activation safety, send guard, duplicate prevention, bulk safety, and preset self-check before transport.
8. Writeback rows show retry metadata.

Stop if validation/auth/not-found/conflict errors are retried automatically.

## Live canary send

Only after sandbox evidence is accepted, test live with exactly one recipient row.

Required settings:

```text
Provider Selector -> Environment Filter = live
Invoice Sender -> Dry Run = false
Invoice Sender -> Activation Safety Mode = liveRealSend
Invoice Sender -> Expected Request Environment = live
Invoice Sender -> Production Preset Self-Check = liveRealSend
Invoice Sender -> Live Mode Confirmation = SEND_REAL_INVOICES
```

Do not enter bulk live confirmation for the first canary.

Pass evidence:

- exactly one live invoice/request is created;
- provider live dashboard confirms the intended customer/account/action;
- n8n execution output shows `activationApproved = true` for live mode;
- `invoice_results` row contains final workflow state and activation metadata;
- idempotency key is visible and stable;
- rerunning the exact same live item is blocked as duplicate or otherwise safely prevented according to the configured idempotency mode.

## Controlled live bulk send

Only after the live canary passes, expand gradually.

Recommended sequence:

1. 2 rows
2. 5 rows
3. 10 rows
4. 25 rows
5. then the approved production batch size

Required settings for live bulk:

```text
Provider Selector -> Environment Filter = live
Invoice Sender -> Dry Run = false
Invoice Sender -> Activation Safety Mode = liveRealSend
Invoice Sender -> Expected Request Environment = live
Invoice Sender -> Production Preset Self-Check = liveRealSend
Invoice Sender -> Enable Bulk Run Safety = true
Invoice Sender -> Require Uniform Environment = true
Invoice Sender -> Live Mode Confirmation = SEND_REAL_INVOICES
Invoice Sender -> Live Bulk Confirmation = SEND_BULK_REAL_INVOICES
```

Recommended starting bulk limits:

```text
Max Invoices Per Execution = 25
Delay Between Real Sends (ms) = 250
Max Failed Sends Before Abort = 2
Stop on Critical Bulk Error = true
```

Increase limits only after provider-specific rate limits and behavior are proven.

## Required final evidence package

Before GitHub/npm publication, save:

1. Local `npm run verify` log showing `1.5.0` and all tests passing.
2. `npm pack --dry-run` package preview showing `n8n-nodes-invoicerouter-1.5.0.tgz`.
3. n8n installed package screenshot or package list evidence.
4. n8n workflow import screenshot showing all eight custom nodes resolved.
5. Dry-run execution export or screenshots.
6. Sandbox real-send execution export or screenshots.
7. Status writeback Sheet rows for dry-run and sandbox tests.
8. Retry/rate-limit validation evidence, if provider/test endpoint supports it.
9. Live one-row canary execution evidence.
10. Provider dashboard/API confirmation for sandbox and live canary.
11. Confirmation that no provider secrets appear in normal n8n outputs.

## Rollback plan

If n8n install or workflow import fails:

1. Disable the imported workflow.
2. Remove the package from the n8n nodes folder or uninstall through the n8n community nodes UI if that is the method used.
3. Restart n8n.
4. Reinstall the previous known-good package only if needed.
5. Do not continue with real API tests until node search/import works again.

If a provider sandbox/live send fails:

1. Stop the workflow.
2. Re-enable Dry Run.
3. Clear real-send confirmation phrases.
4. Review `management.executionLog`, `management.statusWriteback`, provider dashboard logs, and provider API error body.
5. Fix only the provider row, recipient row, template field, or workflow setting that caused the failure.
6. Re-run dry-run before another real send.

## Publish gate

Only publish after:

- local v1.5.0 verify passes;
- n8n dry-run passes;
- sandbox real API send passes;
- status writeback passes;
- retry/writeback behavior is accepted or documented as provider-limited;
- live one-row canary passes;
- Git repository contains only clean source files, no `.git` artifacts inside release zips, no `node_modules`, no generated `dist` committed unless explicitly intended, and no private credentials.

GitHub/npm release command sequence:

```bash
git status
npm run verify
npm pack
git add package.json package-lock.json README.md CHANGELOG.md ARCHITECTURE.md manifest/freeze-v1.0.json docs tests workflows
npm publish --access public
git commit -m "Release InvoiceRouter v1.5.0"
git tag v1.5.0
git push origin main --tags
```

If `npm publish` must happen after Git tagging in your release policy, reverse the final publish/tag order. Keep exactly one published npm version for `1.5.0`.

## Final go/no-go checklist

| Gate | Required result |
|---|---|
| Source version | `1.5.0` |
| Local verify | Pass |
| npm pack | `n8n-nodes-invoicerouter-1.5.0.tgz` |
| n8n install | All eight nodes searchable |
| Workflow import | No missing node types |
| Dry-run | No real provider invoice |
| Status writeback | Rows upsert into `invoice_results` |
| Sandbox real send | Exactly intended sandbox invoice/request |
| Retry validation | Retryable only, capped, no unsafe retries |
| Live canary | Exactly one intended live invoice/request |
| Bulk live | Gradual, capped, monitored |
| Secrets | No raw provider secrets in normal outputs |

A batch is live-approved only when all gates above are complete.
