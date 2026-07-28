# InvoiceRouter Version 1.0 - Final Implementation Freeze

**Status:** FINAL FREEZE  
**Architecture version:** 1.0  
**Product goal:** fast, easy, beginner-friendly, configurable invoice automation for n8n  
**Source of truth:** this file and the files under `docs/freeze/v1.0/`

When any older README, Notion draft, diagram, or existing code conflicts with this freeze, this freeze controls Version 1.0 implementation.

## Final workflow

```text
Manual Trigger
  -> Google Sheets (provider accounts and credentials)
  -> Provider Loader
  -> Provider Selector

Selected Provider Account ----\
Invoice Template ---------------> Request Builder
Email List / Recipient --------/

Request Builder
  -> Invoice Sender
  -> Status Checker
  -> Status Manager
  -> Provider Feedback
  -> Provider Selector runtime state update
```

## Final node inventory

Version 1.0 contains **8 InvoiceRouter custom node types**:

1. Provider Loader
2. Provider Selector
3. Invoice Template
4. Email List
5. Request Builder
6. Invoice Sender
7. Status Checker
8. Status Manager

`Manual Trigger` and `Google Sheets` are built-in n8n nodes and are not part of the InvoiceRouter package.

Parallel lanes repeat the same `Request Builder -> Invoice Sender -> Status Checker` node types. Repeated workers do not create new node types.

## Frozen product decisions

- Provider credentials and account configuration are managed in Google Sheets for Version 1.0.
- Request Builder performs the merge of selected account, invoice template, and one recipient. No separate Merge custom node will be created.
- One Request Builder action processes one recipient with one selected provider account and one invoice template.
- Duplicate recipient use must be prevented within a job/batch.
- Provider Selector owns allocation, locking, release, queue, retry, cooldown, rate limiting, and provider feedback state.
- Invoice Sender only executes the prepared HTTP request and returns a raw execution result.
- Status Checker only analyzes and standardizes the raw result.
- Status Manager owns decisions, retry scheduling, metrics, alerts, audit output, workflow result, and provider feedback.
- Version 1.0 prioritizes guided defaults and presets over advanced configuration complexity.

## Frozen source assets

- `assets/architecture/invoice-router-architecture-v1.0.pdf`
- `assets/architecture/invoice-router-architecture-v1.0.png`
- `examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx`
- Notion parent specification: `https://app.notion.com/p/3a968f0bf27380fda24ae5ddd012fcc8`

## Change control

Implementation may improve internals without changing the frozen external responsibilities. Any change to node count, responsibility boundaries, sheet columns, primary data flow, or credential policy requires a new freeze version.
