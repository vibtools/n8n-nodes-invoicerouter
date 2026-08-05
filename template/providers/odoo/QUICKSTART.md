# Quickstart — Odoo Complete Bulk Email

## 1. Choose the correct mode files

Begin with:

```text
google-sheets-template.xlsx
n8n-import-workflow-dry-run.json
provider.csv
```

Do not begin with a live or bulk workflow.

## 2. Create the private Google Sheet

1. Upload the selected workbook to Google Drive.
2. Open it with Google Sheets.
3. Copy the spreadsheet ID from the URL.
4. Keep the Sheet private and restrict access to the required operators/service account.

## 3. Fill the provider sheet

Replace placeholders in `provider`:

```text
Base URL = https://YOUR-SUBDOMAIN.odoo.com
Endpoint = /jsonrpc
Username = your Odoo username/email
Password = your Odoo password or API key
Database = exact Odoo database name
Extra Config JSON = {"invoiceLifecycle":"createPostAndSendEmail","odooPostInvoice":true,"odooSendInvoiceEmail":true,"odooEmailForceSend":true}
```

Keep one provider environment active during canary testing.

## 4. Fill email_list

Only `Email` is required:

```text
Email,Name,Address
customer@example.com,Customer Example,
```

Replace the reserved example address in your private Sheet. Use exactly one controlled recipient for canary runs.

## 5. Import the workflow

Import `n8n-import-workflow-dry-run.json`. Replace the Google Sheet ID and Google credential in all Google Sheets nodes.

## 6. Verify the package before real transport

```text
npm run verify
```

Confirm all eight custom nodes load in n8n and the first execution remains `DRY_RUN`.

## 7. Promote in order

1. Dry-run validation.
2. Sandbox/test single recipient.
3. Controlled retry-resume proof.
4. Sandbox/test approved bulk.
5. Final complete-project forensic audit.
6. Publish and update through n8n Community Nodes.
7. Live canary single recipient.
8. Live bulk after evidence approval.

## 8. Read email status correctly

- `SENT`: provider-side sent evidence; still check the inbox.
- `QUEUED`: wait and inspect Odoo mail processing.
- `FAILED`: fix the recorded error and use approved retry.
- `UNVERIFIED`: manual review; do not automatically retry.

## Phase 02 campaign rule

Use one pending `Campaign_ID` per execution. Configure every `Campaign Report Input/Lease` Google Sheets node to the same workbook and `campaign_report` tab. Do not run the same campaign concurrently.

## Phase 04 provider fields

`Issuer_Key` is optional. You may leave it blank or use it as an operator label. Leave `Company_ID`, `Company_Name`, version, capability, and compatibility fields for preflight writeback, unless you intentionally configure expected company evidence. Issuer/company differences are diagnostic and do not block sending.

## Phase 06 report fields

Do not manually decrement or reuse `Revision`, `Base_Revision`, or `Writer_Run_ID`. Keep all campaign/account report nodes pointed at the same managed workbook. A stale-writer or revision-gap error is a stop condition: reconcile the current Sheet row and pending `writeback_queue` envelope instead of forcing the older totals over the newer revision.
