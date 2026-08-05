# Bulk Retry and Account Status Troubleshooting

## Account immediately becomes disabled

Inspect `provider.status`, `Status_Reason`, `Last_Error_Type`, and `Last_Error`.

Hard automatic disable is expected only for explicit authentication/authorization failure, invalid database, provider-reported quota exhaustion, or permanent provider disablement. Correct the provider row, set `Enabled=TRUE`, set `status=RESET`, and run a one-recipient canary.

## Account shows RATE_LIMITED

The account remains enabled. InvoiceRouter records `Cooldown_Until`, retries only when safe, and can select another enabled account in the same failover group. Do not change the status to `QUOTA_EXHAUSTED` unless the provider explicitly reports exhausted quota.

## Recipient remains RETRYING or FAILOVER

Check `retry_queue` by `Job_ID`. Verify `Next_Retry_At`, `Attempted_Profile_IDs`, and `Queue_Status`. If all compatible accounts are unavailable, the job remains queued rather than being marked sent.

## Recipient shows MANUAL_REVIEW

Do not rerun the complete workflow for that row. Inspect `invoice_results.lifecycle_checkpoint`, `email_evidence`, and Odoo chatter/mail records. `EMAIL_UNVERIFIED` may mean the email was already sent.

## Status writeback failed after successful send

The managed Google Sheets node retries the write up to three times. If it still fails, use the emitted writeback payload and execute only the failed Google Sheets writeback node. Do not rerun Provider Selector, Request Builder, or Invoice Sender.


## Account excluded before sending

Review the Provider Loader `preflightResults` output and the `provider` tab. Confirm database name, API login/key, requested currency, and access rights. The Provider Loader `Preflight Currency` must match the Invoice Template currency.

## Odoo failover group is blocked

Inspect `Issuer_Key`, `Company_ID`, `Company_Name`, `Odoo_Server_Version`, `Capability_Status`, and `Issuer_Compatibility`. All enabled Odoo rows in the group must be Odoo 18/19 and resolve to one legal issuer/company. The group block is fail-closed and does not permanently disable the source rows.
