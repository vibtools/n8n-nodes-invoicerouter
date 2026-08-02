# Bulk Run Safety

InvoiceRouter supports bulk invoice sending through n8n item processing: each Email List row becomes one guarded invoice request. The production template keeps a single Request Builder / Invoice Sender / Status Checker / Status Manager chain and applies run-level safety controls inside Invoice Sender.

## Controls

Invoice Sender exposes these bulk safety controls:

- `Enable Bulk Run Safety`
- `Max Invoices Per Execution`
- `Require Uniform Environment`
- `Delay Between Real Sends (ms)`
- `Max Failed Sends Before Abort`
- `Stop on Critical Bulk Error`
- `Sandbox Bulk Confirmation`
- `Live Bulk Confirmation`

The production workflow defaults to:

- `Enable Bulk Run Safety = true`
- `Max Invoices Per Execution = 100`
- `Require Uniform Environment = true`
- `Delay Between Real Sends (ms) = 250`
- `Max Failed Sends Before Abort = 5`
- `Stop on Critical Bulk Error = true`
- `Sandbox Bulk Confirmation = blank`
- `Live Bulk Confirmation = blank`

## Confirmation gates

Bulk real sends require the normal activation confirmation and an additional bulk confirmation when more than one item is in the Invoice Sender input.

Sandbox bulk real send requires:

- `Activation Safety Mode = sandboxRealSend`
- `Dry Run = false`
- `Expected Request Environment = sandbox`
- `Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES`
- `Sandbox Bulk Confirmation = SEND_BULK_SANDBOX_INVOICES`

Live bulk real send requires:

- `Activation Safety Mode = liveRealSend`
- `Dry Run = false`
- `Expected Request Environment = live`
- `Live Mode Confirmation = SEND_REAL_INVOICES`
- `Live Bulk Confirmation = SEND_BULK_REAL_INVOICES`

## Abort behavior

When bulk safety is enabled, Invoice Sender can block the entire run before sending or abort remaining items during a run.

The entire run is blocked when:

- item count exceeds `Max Invoices Per Execution`
- sandbox and live requests are mixed while `Require Uniform Environment` is enabled

Remaining items are aborted when:

- a critical send guard, activation, credential, environment, validation, authentication, or authorization error occurs and `Stop on Critical Bulk Error` is enabled
- failed provider transports reach `Max Failed Sends Before Abort`

Blocked/aborted items still flow to Status Checker and Status Manager so writeback and audit rows remain complete.

## Output contract

Invoice Sender attaches `rawExecution.bulkSafety` to every item. Status Checker promotes it to `standardStatus.bulkSafety` and related flat fields. Status Manager adds:

- `management.bulkSummary`
- bulk fields in `management.executionLog`
- bulk fields in `management.statusWriteback.values`

The status writeback branch includes bulk columns such as `bulk_run_id`, `bulk_item_number`, `bulk_total_items`, `bulk_decision`, `bulk_safety`, and `bulk_summary`.

## Production recommendation

Use one bulk lane first. Do not duplicate Request Builder / Invoice Sender branches until a real n8n dry-run, sandbox bulk send, writeback verification, and final audit are complete.

## v2 truthful bulk counters

`management.bulkSummary` distinguishes business lifecycle results rather than counting every HTTP success as sent:

```text
invoiceCreated
invoicePosted
emailRequested
emailSent
emailQueued
emailFailed
emailUnverified
partial
failed
```

The compatibility `sent` counter equals verified `emailSent`. A created or posted invoice is not counted as a sent email. Live bulk remains blocked until a one-recipient canary and retry-resume proof are accepted.
