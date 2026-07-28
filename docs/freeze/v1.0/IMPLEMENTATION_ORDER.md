# Frozen Implementation Order

## Phase 0 - Preserve and branch

- Commit this freeze pack without changing runtime code.
- Tag or record the current working baseline.
- Create branch `feature/v1-final-freeze`.

## Phase 1 - Contracts and shared types

- Freeze TypeScript interfaces for provider sheet row, provider runtime profile, lock, invoice template, recipient, ready request, raw response, standard status, feedback, and workflow result.
- Add secret-redaction and deterministic ID/tag utilities.

## Phase 2 - Data-source nodes

1. Provider Loader
2. Invoice Template
3. Email List

Tests must cover validation, normalization, dynamic tags, name generation, duplicate recipients, and secret masking.

## Phase 3 - Selection engine

Implement Provider Selector incrementally:

1. pool and first-available allocation
2. lock ownership and release
3. duplicate protection
4. timeout recovery
5. retry/cooldown
6. rate limiting and circuit breaker
7. health/scoring and additional strategies

## Phase 4 - Worker pipeline

1. Request Builder merge and provider mapping
2. Invoice Sender raw execution
3. Status Checker response analysis

Start with sequential processing. Add controlled parallel execution only after lock and pairing tests pass.

## Phase 5 - Management layer

Implement Status Manager policy, retry events, feedback, audit output, metrics events, alerts, and final workflow result.

## Phase 6 - n8n workflow and release

- create the final importable workflow JSON
- add demo provider and recipient sheets
- run sandbox provider tests
- run package build and n8n installation test
- release only after all node contracts pass
