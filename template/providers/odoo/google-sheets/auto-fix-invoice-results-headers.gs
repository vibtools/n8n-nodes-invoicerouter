const INVOICE_ROUTER_V210_SCHEMAS = {
  "invoice_results": [
    "writeback_key",
    "writeback_action",
    "writeback_target",
    "key_mode",
    "request_id",
    "transaction_id",
    "idempotency_key",
    "job_id",
    "campaign_id",
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
    "email_evidence",
    "lifecycle_outcome",
    "lifecycle_failed_step",
    "lifecycle_checkpoint",
    "retry_resume_stage",
    "retry_resume",
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
    "updated_at",
    "failover_scheduled",
    "recipient_status",
    "provider_operational_status"
  ],
  "email_list": [
    "Email",
    "status",
    "Name",
    "Address",
    "Job_ID",
    "Campaign_ID",
    "Attempt_Count",
    "Last_Account",
    "Last_Error",
    "Updated_At"
  ],
  "provider": [
    "Enabled",
    "Provider",
    "Account",
    "Environment",
    "Action",
    "Method",
    "Base URL",
    "Endpoint",
    "Auth Type",
    "Username",
    "Password",
    "Database",
    "API Key",
    "API Secret",
    "Extra Config JSON",
    "Timeout",
    "Notes",
    "Failover_Group",
    "status",
    "Status_Reason",
    "Auto_Disabled",
    "Consecutive_Failures",
    "Retry_Count",
    "Cooldown_Until",
    "Last_Error_Type",
    "Last_Error",
    "Last_Used_At",
    "Total_Allocated",
    "Total_Sent",
    "Total_Failed",
    "Updated_At"
  ],
  "retry_queue": [
    "Job_ID",
    "Campaign_ID",
    "Recipient_Email",
    "Original_Profile_ID",
    "Current_Profile_ID",
    "Attempted_Profile_IDs",
    "Failover_Group",
    "Side_Effect_Stage",
    "Required_Profile_ID",
    "Provider_Invoice_ID",
    "Lifecycle_Checkpoint",
    "Resume_Stage",
    "Retry_Count",
    "Failover_Count",
    "Next_Retry_At",
    "Last_Error_Type",
    "Last_Error",
    "Queue_Status",
    "Updated_At"
  ],
  "account_report": [
    "Report_Key",
    "Campaign_ID",
    "Provider",
    "Account_ID",
    "Account_Name",
    "Profile_ID",
    "Current_Status",
    "Enabled",
    "Allocated",
    "Attempted",
    "Succeeded",
    "Email_Sent",
    "Email_Queued",
    "Failed",
    "Retried",
    "Failover_Count",
    "Failover_From",
    "Failover_To",
    "Auto_Disabled",
    "Disabled_Reason",
    "Last_Error_Type",
    "Last_Error",
    "Last_Used_At",
    "Updated_At"
  ],
  "campaign_report": [
    "Report_Key",
    "Campaign_ID",
    "Job_ID",
    "Recipient_Email",
    "Status",
    "Pending",
    "Sent",
    "Queued",
    "Failed",
    "Manual_Review",
    "Duplicate",
    "Retrying",
    "Failover",
    "Account_ID",
    "Updated_At"
  ]
};

function ensureInvoiceRouterSheetHeaders_(spreadsheet, sheetName, requiredHeaders) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((value) => String(value || '').trim());
  const existing = new Set(headers.filter(Boolean));
  const missing = requiredHeaders.filter((header) => !existing.has(header));
  if (missing.length > 0) {
    const firstEmptyColumn = Math.max(sheet.getLastColumn() + 1, 1);
    sheet.getRange(1, firstEmptyColumn, 1, missing.length).setValues([missing]);
    if (firstEmptyColumn > 1) {
      sheet.getRange(1, firstEmptyColumn - 1).copyTo(
        sheet.getRange(1, firstEmptyColumn, 1, missing.length),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false,
      );
    }
    sheet.autoResizeColumns(firstEmptyColumn, missing.length);
  }
  sheet.setFrozenRows(1);
  return { sheetName, added: missing };
}

function fixInvoiceRouterV210Workbook() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const results = Object.entries(INVOICE_ROUTER_V210_SCHEMAS).map(([sheetName, requiredHeaders]) =>
    ensureInvoiceRouterSheetHeaders_(spreadsheet, sheetName, requiredHeaders),
  );
  Logger.log(JSON.stringify(results));
}

function fixInvoiceRouterInvoiceResultsHeaders() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const result = ensureInvoiceRouterSheetHeaders_(spreadsheet, 'invoice_results', INVOICE_ROUTER_V210_SCHEMAS.invoice_results);
  Logger.log(JSON.stringify(result));
}
