import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './StatusManager.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, icon: 'file:invoice-router-status-manager.svg', group: ['transform'], version: 1,
  description: 'Apply policy, create retry/metrics/alert/audit events, and produce hardened execution-log/writeback payloads.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main'], outputs: ['main'],
  properties: [
    { displayName: 'Retry Limit', name: 'retryLimit', type: 'number', default: 3 },
    { displayName: 'Retry Base Delay (seconds)', name: 'retryBaseDelaySeconds', type: 'number', default: 30 },
    { displayName: 'Retry Max Delay (seconds)', name: 'retryMaxDelaySeconds', type: 'number', default: 900, description: 'Upper bound for exponential backoff and provider retry-after delays.' },
    { displayName: 'Respect Provider Retry-After', name: 'respectRetryAfterHeader', type: 'boolean', default: true, description: 'Use Retry-After or rate-limit reset hints from provider responses when scheduling retries.' },
    { displayName: 'Default Cooldown (seconds)', name: 'cooldownSeconds', type: 'number', default: 30 },
    { displayName: 'Disable Account on Authentication Failure', name: 'disableOnAuthFailure', type: 'boolean', default: true },
    { displayName: 'Create Alert on Failure', name: 'alertOnFailure', type: 'boolean', default: true },
    { displayName: 'Include Management Events', name: 'includeEvents', type: 'boolean', default: true },
    { displayName: 'Include Execution Log', name: 'includeExecutionLog', type: 'boolean', default: true, description: 'Attach a normalized executionLog object for audit trails and downstream log sinks.' },
    { displayName: 'Persist Execution Log', name: 'persistExecutionLog', type: 'boolean', default: false, description: 'Best-effort local workflow static-data persistence. Use an external DB/sheet node for production-grade storage.' },
    { displayName: 'Execution Log Retention', name: 'executionLogRetention', type: 'number', default: 500, description: 'Maximum static-data execution-log entries retained when persistence is enabled.' },
    { displayName: 'Include Status Writeback', name: 'includeStatusWriteback', type: 'boolean', default: true, description: 'Attach a normalized UPSERT payload for downstream Google Sheets, database, or webhook writeback nodes.' },
    { displayName: 'Writeback Target', name: 'writebackTarget', type: 'string', default: 'invoice_results', description: 'Logical downstream table, sheet, or collection name for status writeback.' },
    { displayName: 'Writeback Key Mode', name: 'writebackKeyMode', type: 'options', default: 'requestId', options: [
      { name: 'Request ID', value: 'requestId', description: 'Use the resolved invoice/request ID as the writeback key.' },
      { name: 'Idempotency Key', value: 'idempotencyKey', description: 'Use the generated idempotency key as the writeback key, falling back to request ID.' },
      { name: 'Provider Invoice ID', value: 'providerInvoiceId', description: 'Use provider invoice ID when available, falling back to request ID.' },
      { name: 'Transaction ID', value: 'transactionId', description: 'Use internal transaction ID when available, falling back to request ID.' },
    ] },
  ],
};
