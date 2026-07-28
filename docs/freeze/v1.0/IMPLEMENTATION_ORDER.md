# Frozen Implementation Order — Completion Record

## Phase 0 — Preserve and branch

Status: **Complete**

- Freeze committed and preserved.
- Implementation isolated on the feature branch.
- Legacy/conflicting repository content removed.

## Phase 1 — Contracts and shared types

Status: **Complete**

- Runtime provider, lock, template, recipient, request, response, status, feedback, and workflow-result contracts implemented.
- Secret redaction and deterministic tag utilities implemented.

## Phase 2 — Data-source nodes

Status: **Complete**

1. Provider Loader
2. Invoice Template
3. Email List

## Phase 3 — Selection engine

Status: **Complete for Version 1 process-local runtime**

- first available, round robin, least recently used, least busy, highest health, and weighted strategies
- sequential beginner mode and parallel lock mode
- lock ownership, timeout recovery, cooldown, rate limit, circuit breaker, health score, and feedback update

## Phase 4 — Worker pipeline

Status: **Complete**

1. Request Builder three-input merge and provider mapping
2. Invoice Sender late credential injection and raw execution
3. Status Checker response analysis

## Phase 5 — Management layer

Status: **Complete**

Status Manager creates policy decisions, retry events, feedback, audit output, metrics/analytics events, alerts, notification events, and final workflow results.

## Phase 6 — n8n workflow and release

Status: **Code complete; live provider onboarding remains**

- final importable workflow JSON created
- provider workbook included
- build and automated tests pass
- npm package dry-run required before delivery
- each live provider must still be tested in its sandbox/account
