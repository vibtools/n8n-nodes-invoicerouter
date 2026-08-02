# Status Writeback Wiring

## Scope

Step 09 wires the prepared `management.statusWriteback` payload into explicit built-in n8n nodes:

```text
Status Manager -> Prepare Status Writeback Row -> Google Sheets - Status Writeback
```

This does not add a ninth custom InvoiceRouter node. The frozen package still registers exactly eight custom nodes. The added nodes are standard n8n nodes inside the importable workflow template.

## Purpose

Status Manager emits a normalized UPSERT payload. The workflow now converts that payload into a flat row and sends it to a Google Sheets `appendOrUpdate` node so executions can be reviewed without manually copying nested JSON from the n8n execution view.

## Required Sheet

Create a private Google Sheet tab named:

```text
invoice_results
```

Use the column header template from:

```text
examples/n8n_dry_run_validation/status-writeback-columns.csv
```

The first column must be:

```text
writeback_key
```

`writeback_key` is the matching/upsert column for the Google Sheets node. The bundled workflow sets Status Manager writeback key mode to `idempotencyKey`, so repeated executions of the same guarded request update the same logical row instead of creating unbounded duplicates.

## Workflow Node Settings

### Prepare Status Writeback Row

Built-in node type:

```text
n8n-nodes-base.code
```

This node flattens:

```text
management.statusWriteback.values
```

into top-level row fields such as:

```text
writeback_key
request_id
idempotency_key
recipient_email
workflow_state
result
transport_status
http_status
error_category
error_severity
retry_delay_seconds
retry_decision_source
retry_decision_reason
retry_after_seconds
retry_delay_hint_seconds
error_code
managed_at
updated_at
```

### Google Sheets - Status Writeback

Built-in node type:

```text
n8n-nodes-base.googleSheets
```

Required settings:

| Setting | Required value |
|---|---|
| Operation | `appendOrUpdate` |
| Document ID | Private status/writeback Sheet ID |
| Sheet Name | `invoice_results` |
| Matching Column | `writeback_key` |
| Credential | Same approved Google Sheets OAuth2 credential or a dedicated restricted credential |

## Safety Boundary

This wiring writes execution status only. It does not send provider invoices. It is safe to test while Invoice Sender remains in Dry Run mode.

Before running the workflow in n8n, replace all placeholder Sheet IDs and credentials:

| Node | Placeholder to replace |
|---|---|
| Google Sheets - Provider Accounts | `REPLACE_PROVIDER_SPREADSHEET_ID` |
| Google Sheets - Email List | `REPLACE_EMAIL_SPREADSHEET_ID` |
| Google Sheets - Status Writeback | `REPLACE_STATUS_SPREADSHEET_ID` |
| All Google Sheets nodes | `REPLACE_GOOGLE_CREDENTIAL_ID` |

## Expected Dry-Run Rows

During Dry Run validation, writeback rows should include a mix of guarded outcomes:

| Expected type | Meaning |
|---|---|
| `PROCESSING` / `DRY_RUN` | Request was built and previewed without provider HTTP transport. |
| `BLOCKED` | Routing or send guard intentionally prevented transport. |
| `DUPLICATE` | Duplicate prevention blocked a repeated live request; Dry Run does not reserve duplicate keys. |
| `FAILED` | Only expected when validation data or node configuration is intentionally invalid. |

## Production Rule

Do not use this Sheet as the only source of financial truth. It is an operational audit/status surface for n8n executions. Provider-side invoices, accounting ledgers, and payment provider records remain authoritative for financial reconciliation.

## Step 11 activation fields

The writeback branch now carries activation safety metadata from Invoice Sender through Status Checker and Status Manager:

| Column | Source |
|---|---|
| `activation_mode` | `management.statusWriteback.values.activationMode` |
| `activation_approved` | `management.statusWriteback.values.activationApproved` |
| `activation_safety` | JSON string of `management.statusWriteback.values.activationSafety` |

These fields are required for post-run forensic review before promoting from dry-run validation to sandbox real send or from sandbox real send to live real send.

## v2 lifecycle evidence additions

The canonical header is now `template/status-writeback-columns.csv`. Existing columns remain unchanged, and these fields are additive:

```text
email_evidence
lifecycle_outcome
lifecycle_failed_step
lifecycle_checkpoint
retry_resume_stage
retry_resume
```

All workflow mappings must use valid n8n expression syntax, for example:

```text
={{ $json.email_send_status }}
```

A successful transport does not override provider lifecycle evidence. Requested email outcomes remain distinct as `QUEUED`, `SENT`, `FAILED`, or `UNVERIFIED`.
