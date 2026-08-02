# n8n Import Guide — Zoho Books

1. Import the JSON workflow.
2. Replace `REPLACE_ZOHO_BOOKS_SPREADSHEET_ID` in all Google Sheets nodes.
3. Select your Google Sheets OAuth credential.
4. Confirm Provider Selector:
   - Provider Filter = Zoho Books
   - Action Filter = Create Invoice
   - Environment Filter = sandbox
5. Confirm Invoice Sender starts in dry-run mode.
6. Execute the full workflow from the Manual Trigger.
