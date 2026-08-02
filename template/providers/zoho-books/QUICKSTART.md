# Quickstart — Zoho Books Complete Bulk Email

1. Upload the included `.xlsx` workbook to Google Drive and open it as Google Sheets.
2. Replace placeholders in the `provider` sheet:
   - `API Key` = Zoho OAuth access token
   - `Extra Value` = Zoho Books organization ID
   - `Base URL` = correct Zoho API data center URL
3. Keep only one provider row enabled.
4. Import the n8n JSON workflow.
5. Connect all three Google Sheets nodes to the workbook tabs:
   - `provider`
   - `email_list`
   - `invoice_results`
6. Run dry-run first.
7. Then run test organization/sandbox one-row real send.
8. Then run live canary one-row.
9. Only then run live bulk.
