# Phase 07 final release gate

Phase 07 combines the automated pre-release publication gate with the reviewed post-publication live-acceptance gate for InvoiceRouter v2.1.1. It does not redesign the frozen eight-node architecture and does not grant production approval merely because unit tests pass.

## Frozen target

- Package: `n8n-nodes-invoicerouter@2.1.1`
- Workflow engine: `n8n@2.31.6`
- Canonical Odoo workflow: 126 nodes, 141 edges, eight InvoiceRouter custom nodes
- Supported Odoo capability profiles: 18 and 19

## Automated gates

### Static gate

```bash
npm run verify:phase07:static
```

This verifies package metadata, workflow topology, canonical/live-bulk byte identity, the exact engine fixture, Odoo 18/19 fixtures, short-secret redaction, CI/release wiring, and sanitized evidence templates. It does not claim live provider success.

### Exact engine smoke

```bash
npm run verify:phase07:engine
```

The command builds and packs the current source, installs the package in an isolated custom-extension directory, launches exactly `n8n@2.31.6`, and executes `tests/fixtures/n8n/InvoiceRouter-Phase-07-Engine-Smoke.json`. It then copies the unchanged canonical workflow bytes into an isolated temporary import directory and uses `import:workflow --separate`, allowing n8n to generate a transient database workflow ID without adding a fixed ID to the public canonical JSON. The gate exports the imported complete 126-node/141-edge workflow and verifies all eight custom-node types. The launcher calls npm through `process.execPath + npm_execpath`, avoiding the Windows `.cmd` direct-spawn failure. Evidence includes fixture, canonical workflow, tarball, execution-log, and import/export hashes and is written to `evidence/phase07/n8n-engine-smoke.json` and `.log`.

### Runtime restart/worker regression

The automated test suite launches separate Node.js processes using a 66-second resume marker. Each process must rebuild the provider pool and secret vault, allocate the same required profile, and keep secrets out of the sanitized provider library. This proves process-independent rehydration logic, not n8n database wait/resume itself. A real restart or worker change after a durable wait must be demonstrated in the reviewed pilot.

### Odoo 18/19 fixtures

Fixture-driven tests cover read-only preflight, version-specific capability selection, customer/invoice creation, posting, send-wizard execution, mail evidence, PDF attachment identity, Status Checker, and Status Manager. They are deterministic mocks, not live Odoo proof.

## Post-publication live evidence gate

After GitHub/npm publication and the n8n Community Nodes update, the live-acceptance command is intentionally fail-closed:

```bash
npm run verify:phase07:evidence
```

It requires reviewed files:

- `evidence/phase07/n8n-engine-smoke.json`
- `evidence/phase07/canary-evidence.json`
- `evidence/phase07/pilot-evidence.json`

The one-recipient canary must prove one posted invoice, zero duplicates, provider-side `SENT`, valid PDF evidence, manual inbox receipt, matching Sheet writeback, and a `COMPLETE` operation envelope.

The five-recipient/two-account pilot must exercise failover and restart/other-worker resume, prove five terminal recipients and five invoices with zero duplicates, five provider-side `SENT` results and inbox confirmations, complete envelopes, stale-writer rejection, and no revision regression.

Templates remain `PENDING`. No tool or script automatically converts them to `PASS`.

## Security evidence policy

Evidence may contain hashes, aggregate counts, timestamps, and sanitized file references. It must not contain recipient addresses, passwords, API keys, tokens, authorization headers, cookies, credential objects, or raw provider payloads.

## Release decision

GitHub tag and npm publication are gated by source validation, the static gate, exact n8n engine smoke, tag/version matching, and npm credential validation. After publication, update the package through n8n Community Nodes, run the reviewed one-recipient canary and five-recipient/two-account pilot, and require `npm run verify:phase07:evidence` to pass before production bulk approval.


## Final corrective recovery contract

Before provider work, Request Builder creates the stable invoice reference. The workflow then rereads `campaign_report`, verifies the active `Run_ID` and unexpired lease, and writes that exact reference to the `PROVIDER_PENDING` envelope. On restart, unresolved envelopes are reconstructed and forced through Odoo stable-reference reconciliation. A recovered posted invoice without trusted email checkpoint is manual-review only.

Canary and pilot evidence must be bound to the exact engine evidence SHA-256, package tarball SHA-256, and canonical workflow SHA-256. Evidence files also require sanitized artifact digests and reviewer metadata.

## Recipient identity bootstrap gate

The first identity persistence is a row-number update, not a `Row_ID` upsert. The Google Sheets read operation emits virtual `row_number`; Email List carries it as `job.sourceRow`; the workflow updates that exact row and writes `Row_ID`. Every later recipient write is keyed by the immutable `Row_ID`. Missing or invalid source row numbers fail closed before provider work.

## Deterministic evidence binding

Canary and pilot evidence bind to `engineBindingSha256` and `packageContentSha256`, not to the entire engine-evidence JSON file. Engine evidence contains execution timestamps and is regenerated by CI; hashing the full file would make a valid reviewed canary impossible to reproduce. The deterministic binding covers exact n8n version, package/version, fixture hash, canonical workflow hash, packaged file-content hash, eight-node count, imported topology, and dry-run mode.

## Cross-platform byte determinism

Repository text checkout is pinned to LF by `.gitattributes`, and TypeScript output uses `compilerOptions.newLine = "lf"`. These controls are mandatory because `packageContentSha256` hashes packaged file bytes and must reproduce across Windows verification and Linux CI.
## Artifact hash verification

Canary and pilot `evidenceArtifacts` are not hash placeholders. Each name resolves below `evidence/phase07/artifacts/`, is restricted to a sanitized text format, must exist, and must match the declared SHA-256. The gate also scans artifact text for email addresses and secret-bearing values.
