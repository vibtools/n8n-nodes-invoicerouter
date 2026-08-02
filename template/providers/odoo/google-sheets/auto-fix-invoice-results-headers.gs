function fixInvoiceRouterInvoiceResultsHeaders() {
  const sheetName = 'invoice_results';
  const requiredHeaders = [
  "writeback_key",
  "writeback_action",
  "writeback_target",
  "key_mode",
  "request_id",
  "transaction_id",
  "idempotency_key",
  "provider_id",
  "profile_id",
  "account_id",
  "action_id",
  "worker_id",
  "recipient_email",
  "workflow_state",
  "result",
  "invoice_status",
  "provider_status",
  "transport_status",
  "provider_customer_id",
  "customer_status",
  "post_status",
  "email_send_requested",
  "email_send_status",
  "email_send_method",
  "email_error_message",
  "provider_invoice_id",
  "invoice_number",
  "invoice_url",
  "pdf_url",
  "http_status",
  "error_type",
  "error_category",
  "error_severity",
  "error_code",
  "error_message",
  "retry_scheduled",
  "retry_count",
  "retry_delay_seconds",
  "retry_decision_source",
  "retry_decision_reason",
  "retry_after_seconds",
  "retry_delay_hint_seconds",
  "next_retry_at",
  "lifecycle_mode",
  "lifecycle_steps",
  "provider_recipe_id",
  "preset_self_check_mode",
  "preset_self_check_approved",
  "preset_self_check",
  "activation_mode",
  "activation_approved",
  "activation_safety",
  "bulk_run_id",
  "bulk_item_number",
  "bulk_total_items",
  "bulk_decision",
  "bulk_safety",
  "bulk_summary",
  "retryable_by_policy",
  "non_retryable_by_policy",
  "duplicate_prevention",
  "checked_at",
  "managed_at",
  "updated_at"
];
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((value) => String(value || '').trim());
  const existing = new Set(headers.filter(Boolean));
  const missing = requiredHeaders.filter((header) => !existing.has(header));
  if (missing.length === 0) {
    Logger.log('InvoiceRouter invoice_results headers already exist. Nothing to add.');
    return;
  }
  const firstEmptyColumn = sheet.getLastColumn() + 1;
  sheet.getRange(1, firstEmptyColumn, 1, missing.length).setValues([missing]);
  const sourceHeaderCell = sheet.getRange(1, Math.max(firstEmptyColumn - 1, 1));
  sourceHeaderCell.copyTo(sheet.getRange(1, firstEmptyColumn, 1, missing.length), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(firstEmptyColumn, missing.length);
  Logger.log(`Added missing headers: ${missing.join(', ')}`);
}
