# InvoiceRouter n8n Workflow Templates

## `google-sheets-real-invoice-router.json`

This workflow reads rows whose `status` is `PENDING`, normalizes each row, executes the configured provider API, and updates the same row with success or failure details.

After importing it into n8n:

1. Select Google Sheets credentials, spreadsheet, and sheet in all three Google Sheets nodes.
2. Create an **InvoiceRouter API** credential and select it in **Create and Send Invoice**.
3. Configure the provider's real create/send endpoints and response paths.
4. Run once with **Dry Run** enabled and inspect the request plans.
5. Disable Dry Run only after sandbox verification.
6. Activate the schedule when production validation is complete.

Required columns:

`request_id`, `provider`, `customer_name`, `customer_email`, `amount`, `currency`, `due_date`, `description`, `line_items_json`, `metadata_json`, `send_email`, `status`, `invoice_id`, `invoice_url`, `pdf_url`, `sent_at`, `retry_count`, `last_error`.

Never store provider API keys in Google Sheets or workflow JSON. Store them only in n8n credentials.
