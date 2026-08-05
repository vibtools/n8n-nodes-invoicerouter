# InvoiceRouter v2.1.1 Production Corrective Patch

## Scope lock

This release corrects the approved v2.1.0 production behavior without changing the frozen architecture, public node names, file/module names, technology stack, or eight-node registration.

## Corrected contracts

- Request Builder accepts the canonical embedded single input and legacy three-input wiring.
- Odoo preflight uses public, read-only, version-aware API calls.
- A missing eligible provider remains queued and restart-safe.
- Campaign limits, delays, failure thresholds, confirmations, and pauses are campaign-wide.
- Provider side effects use stable campaign/job references and are reconciled after ambiguous transport outcomes.
- Google Sheets job identity and statuses are monotonic and writebacks complete before the next job.
- Writeback repair is isolated from provider execution.
- Odoo sent/queued evidence is current-attempt and intended-recipient bound.
- Account and campaign reports use truthful counters.

## Frozen invariants

- Custom nodes: 8/8.
- Runtime dependencies: 0.
- No node, file, module, API, workflow goal, or technology replacement.
- Legacy workflows remain supported.
## Final hardening phase status

- Phase 01 runtime rehydration: complete; user CMD verification passed.
- Phase 02 durable campaign state and execution lease: complete; user CMD verification passed.
- Phase 03 Odoo truthfulness and evidence correction: complete; user CMD verification passed.
- Phase 04 Odoo capability/version/issuer compatibility: complete; user CMD verification passed.
- Phase 05 exactly-once Sheet operation envelope and immutable keys: complete; user CMD verification passed.
- Phase 06 monotonic reporting and stale-writer protection: complete; user CMD verification passed.
- Phase 07 source/static gate: complete after final corrective audit; exact engine and reviewed live evidence remain pending.

Phase 01 changes the Odoo retry/failover workflow path to read the provider Sheet and execute the existing Provider Loader after every Wait. The provider pool and secret vault are rebuilt before required-profile retry or fresh-profile failover selection.


## Phase 02 durable campaign boundary

Phase 02 adds Sheet-derived campaign reconstruction, mixed pending `Campaign_ID` blocking, and a `campaign_report` run lease with `Run_State`, `Run_ID`, acquisition/expiry timestamps, `Revision`, and `Last_Attempt_At`. The workflow writes and rereads the lease before provider selection, and releases it after the loop. No custom node, module, API, library, or UX contract is renamed or removed.

## Phase 03 Odoo truthfulness boundary

Phase 03 preserves structured Odoo operation metadata and gives attempt-bound intended-recipient evidence precedence over an ambiguous send-wizard transport result. `SENT` and `QUEUED` evidence remain authoritative; explicit terminal provider failure remains `FAILED`; ambiguous send transport with no terminal evidence is `UNVERIFIED` and manual-review only.

Customer lookup is case-insensitive exact-match and fail-closed for duplicate contacts. RFC display-name recipients are normalized before evidence comparison. PDF proof is independently validated from `ir.attachment` MIME, model, invoice, current-attempt message binding, and `invoice_pdf_report_id`. None of these corrections claim inbox delivery or change the frozen eight-node topology.

## Phase 04 completed implementation boundary

Phase 04 adds the shared Odoo capability manifest, capability-driven version handling, authenticated company evidence, and legal-issuer failover gate. It preserves the frozen eight-node architecture.

## Phase 05 exactly-once Sheet boundary

Phase 05 writes a `PROVIDER_PENDING` operation envelope before provider side effects and advances the same `Operation_ID` through provider result and completion checkpoints. Recipient writes use immutable `Row_ID`; provider-row writes use `Profile_ID`. The workflow adds built-in hard-gate nodes without changing the eight custom-node architecture.

## Phase 06 monotonic reporting boundary

Phase 06 adds compare-before-write revision gates for `campaign_report` and `account_report`. A candidate must use the current Sheet `Revision` as `Base_Revision`, advance exactly once, and—on campaign rows—belong to the active lease `Run_ID`. Startup campaign totals are rebuilt from durable recipient/result/retry evidence, stale repair payloads cannot overwrite newer rows, and issuer mismatch preflight evidence is persisted as a revisioned `account_report` diagnostic.

## Phase 07 final gate

The corrective patch may be published after source validation, the Phase 07 static gate, exact n8n 2.31.6 engine evidence, tag/version matching, and npm credential validation pass. After publication and the n8n Community Nodes update, sanitized live canary/pilot evidence must satisfy `npm run verify:phase07:evidence` before production bulk approval. The eight custom nodes and existing runtime workflow remain frozen.


## Final corrective audit boundary

The final source correction keeps eight custom nodes and adds two built-in workflow gates, producing 132 nodes and 148 edges. It fixes Windows engine launching, complete canonical import/export, exact stable-reference operation envelopes, unresolved `PROVIDER_PENDING` startup reconciliation, immediate pre-side-effect lease verification, evidence hash binding, and npm credential preflight. GitHub/npm publication remains blocked until the automated source/static/engine/version/credential gates pass; production bulk approval remains blocked until the post-publication canary/pilot evidence gate passes.

### Final recipient identity correction

The first `Row_ID` write uses the exact virtual Google Sheets `row_number`; all later recipient writes use the persisted `Row_ID`. This is required to prevent duplicate-row creation during identity bootstrap.
