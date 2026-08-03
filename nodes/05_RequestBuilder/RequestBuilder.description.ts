import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './RequestBuilder.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, icon: 'file:invoice-router-request-builder.svg', group: ['transform'], version: 1,
  description: 'Merge one allocated account, one invoice template, and one recipient into a guarded ready-to-send provider request.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main', 'main', 'main'], outputs: ['main'],
  properties: [
    { displayName: 'Strict Provider Warnings', name: 'strictProviderWarnings', type: 'boolean', default: false, description: 'Stop when a provider preset reports non-fatal provider-specific warnings.' },
    { displayName: 'Strict Provider Validation', name: 'strictProviderValidation', type: 'boolean', default: false, description: 'Stop when provider-specific required fields, invoice essentials, or profile essentials are missing.' },
    { displayName: 'Send Guard Mode', name: 'sendGuardMode', type: 'options', default: 'audit', options: [
      { name: 'Audit Only', value: 'audit', description: 'Attach sendGuard metadata without stopping the item.' },
      { name: 'Strict', value: 'strict', description: 'Stop if the prepared request fails guard checks.' },
    ], description: 'Controls Request Builder guard checks before the request reaches Invoice Sender.' },
    { displayName: 'Custom Body Override JSON', name: 'customBodyJson', type: 'json', default: '{}', description: 'Optional complete body override. Leave {} to use the built-in provider preset.' },
    { displayName: 'Extra Headers JSON', name: 'extraHeadersJson', type: 'json', default: '{}' },
    { displayName: 'Extra Query JSON', name: 'extraQueryJson', type: 'json', default: '{}' },
    { displayName: 'Idempotency Header', name: 'idempotencyHeader', type: 'string', default: 'Idempotency-Key' },
    { displayName: 'Idempotency Key Mode', name: 'idempotencyKeyMode', type: 'options', default: 'requestId', options: [
      { name: 'Existing Request ID', value: 'requestId', description: 'Use the resolved invoice ID/request ID exactly as the idempotency value.' },
      { name: 'Provider + Invoice', value: 'providerInvoiceOnly', description: 'Use provider, profile, action, environment, and invoice ID to create a stable duplicate-prevention key.' },
      { name: 'Provider + Invoice + Recipient', value: 'providerInvoiceRecipient', description: 'Use provider, profile, action, environment, invoice ID, and recipient email to create a stable duplicate-prevention key.' },
      { name: 'Campaign + Job', value: 'campaignJob', description: 'Use provider, failover group, campaign ID, job ID, and action. Safe for restart and pre-side-effect account failover.' },
    ], description: 'Controls the idempotency value passed to Invoice Sender and the provider API header.' },
    { displayName: 'Idempotency Scope', name: 'idempotencyScope', type: 'options', default: 'workflow', options: [
      { name: 'Workflow', value: 'workflow', description: 'Prevent duplicates across all executions of this workflow while stored history is retained.' },
      { name: 'Batch', value: 'batch', description: 'Prevent duplicates only within the current runtime batch scope.' },
      { name: 'Provider Profile', value: 'providerProfile', description: 'Prevent duplicates within the current workflow and provider profile.' },
    ], description: 'Used by Invoice Sender duplicate prevention when enabled.' },
    { displayName: 'Allow HTTP URL', name: 'allowHttp', type: 'boolean', default: false, description: 'Keep disabled in production. Localhost HTTP is always allowed.' },
  ],
};
