# Phase 07 release evidence

This directory contains sanitized evidence templates for the post-publication InvoiceRouter v2.1.1 production-approval gate.

## Generated engine evidence

Run:

```bash
npm run verify:phase07:engine
```

The command executes the dry-run-only fixture through **n8n 2.31.6** and writes:

- `n8n-engine-smoke.json`
- `n8n-engine-smoke.log`

The engine gate is not a live provider test.

## Canary evidence

Copy `canary-evidence.template.json` to `canary-evidence.json` only after a one-recipient live canary has been reviewed. Record hashes and aggregate facts, not recipient addresses or provider secrets.

The canary must prove one posted invoice, provider-side `SENT`, a valid invoice PDF attachment, manual inbox receipt, matching Sheet writeback, and a `COMPLETE` operation envelope with zero duplicate invoices.

## Pilot evidence

Copy `pilot-evidence.template.json` to `pilot-evidence.json` only after a five-recipient, two-account pilot. The pilot must exercise failover and restart/other-worker resume, prove zero duplicate invoices, complete five operation envelopes, reject at least one stale writer, and show no revision regression.

## Post-publication production-approval gate

```bash
npm run verify:phase07:evidence
```

Run this command after GitHub/npm publication, the n8n Community Nodes update, the reviewed one-recipient canary, and the five-recipient/two-account pilot. The command fails closed until all three evidence files are present and satisfy the frozen acceptance criteria. It never converts `PENDING` evidence to `PASS` automatically.


## Evidence binding requirements

Canary and pilot evidence must reference the SHA-256 of the generated engine evidence, engine-tested npm tarball, and canonical workflow. Campaign/recipient identifiers are hashes only. Each live evidence file must list at least one sanitized artifact name and SHA-256 plus reviewer name and ISO review timestamp. Email addresses, credentials, tokens, raw provider payloads, and secret-bearing URLs are rejected.

## Stable binding fields

Copy `engineBindingSha256` and `packageContentSha256` from the passing engine evidence into canary and pilot evidence. Do not bind to the complete engine-evidence file hash because timestamps change on every CI execution.
## Sanitized supporting artifacts

Every `evidenceArtifacts[].name` must be a relative file beneath `evidence/phase07/artifacts/` and use `.json`, `.txt`, `.log`, or `.md`. The final gate reads the file, verifies its declared SHA-256, rejects path traversal, and scans textual content for email addresses and secret-like values. Arbitrary or missing digests no longer satisfy the gate.
