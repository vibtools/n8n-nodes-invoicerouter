# Odoo Production Bulk Reliability v2.1.0

InvoiceRouter v2.1.0 keeps one Odoo production workflow and one Google Sheet for account testing, pilot bulk, and production bulk.

## Operator flow

1. Add Odoo accounts to `provider`.
2. Set only the account under test to `Enabled=TRUE`.
3. Add one recipient to `email_list` and execute the same production workflow with a one-item limit.
4. After every account passes its own canary, enable the approved accounts and run a five-recipient pilot.
5. Increase the campaign size only after `email_list`, `invoice_results`, `account_report`, and `campaign_report` reconcile.

## Workbook tabs

- `provider`: credentials, failover group, current account status, disable reason, cooldown, and cumulative counters.
- `email_list`: recipient data plus real-time managed status, stable job identity, attempts, last account, and last error.
- `invoice_results`: immutable provider/lifecycle evidence and idempotency results.
- `retry_queue`: restart-safe retry/failover state.
- `account_report`: one cumulative row per campaign/account profile with allocation, sent, queued, failed, retry, failover, and disable-reason totals.
- `campaign_report`: one event row per recipient decision.

## Recipient status values

`PENDING`, `PROCESSING`, `RETRYING`, `FAILOVER`, `SENT`, `QUEUED`, `FAILED`, `MANUAL_REVIEW`, `DUPLICATE`, and `BLOCKED`.

`SENT` means provider-side current-attempt evidence. Inbox receipt remains a separate operational confirmation.

## Account preflight

Before recipient processing, the canonical workflow performs read-only Odoo authentication, active-currency, and access-right checks for each `Enabled=TRUE` account. Failed accounts are reported to `provider`; no invoice is created during preflight. Keep Provider Loader `Preflight Currency` equal to the Invoice Template currency.

## Retry and failover boundary

- Before any provider invoice exists, a retryable transport/provider failure can retry the same account and then fail over to another enabled account in the same `Failover_Group`.
- After a draft invoice exists, retry is locked to the original account and resumes at `invoice.post`.
- After the invoice is posted, retry is locked to the original account and resumes at `invoice.send_email`.
- `QUEUED` and `UNVERIFIED` are never blindly resent.
- Every managed Google Sheets write node retries the write up to three times without re-entering Invoice Sender. A remaining Sheet failure is repaired by executing only that failed writeback node.

## Account status values

`READY`, `IN_USE`, `COOLDOWN`, `RATE_LIMITED`, `QUOTA_EXHAUSTED`, `AUTH_FAILED`, `AUTHORIZATION_FAILED`, `DATABASE_INVALID`, `CURRENCY_INCOMPATIBLE`, `CONFIGURATION_ERROR`, `MANUAL_REVIEW`, `DISABLED_AUTO`, and `DISABLED_USER`.

Automatic `Enabled=FALSE` is limited to explicit hard account failures such as authentication, authorization, invalid database, or provider-reported quota exhaustion. Temporary rate limiting keeps the account enabled and applies cooldown.
