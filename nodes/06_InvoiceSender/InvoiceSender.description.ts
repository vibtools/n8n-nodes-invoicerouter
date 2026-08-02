import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './InvoiceSender.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, icon: 'file:invoice-router-invoice-sender.svg', group: ['transform'], version: 1,
  description: 'Execute exactly one prepared provider request and return a redacted raw execution result.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main'], outputs: ['main'],
  properties: [
    { displayName: 'Dry Run', name: 'dryRun', type: 'boolean', default: false },
    { displayName: 'Production Preset Self-Check', name: 'productionPresetMode', type: 'options', default: 'off', options: [
      { name: 'Off', value: 'off', description: 'Do not enforce a production preset fingerprint.' },
      { name: 'Dry Run Validation', value: 'dryRunValidation', description: 'Block execution unless the node still matches the safe first-import dry-run preset.' },
      { name: 'Sandbox Real Send', value: 'sandboxRealSend', description: 'Block execution unless the node matches the guarded sandbox real-send preset.' },
      { name: 'Live Real Send', value: 'liveRealSend', description: 'Block execution unless the node matches the guarded live real-send preset.' },
    ], description: 'Self-checks critical node settings at run time so UI reset or accidental edits cannot silently weaken invoice-sending safety.' },
    { displayName: 'Include Response Body', name: 'includeResponseBody', type: 'boolean', default: true },
    { displayName: 'Require Send Guard', name: 'requireSendGuard', type: 'boolean', default: false, description: 'When enabled, Invoice Sender blocks any item that does not contain an approved readyRequest.sendGuard.' },
    { displayName: 'Live Mode Confirmation', name: 'liveModeConfirmation', type: 'string', default: '', description: 'When Require Send Guard is enabled and Dry Run is off, enter SEND_REAL_INVOICES to allow real HTTP invoice sends.' },
    { displayName: 'Prevent Duplicate Sends', name: 'preventDuplicateSends', type: 'boolean', default: false, description: 'When enabled for live mode, reserve and persist idempotency keys before HTTP transport and block duplicate sends.' },
    { displayName: 'Duplicate TTL Hours', name: 'duplicateTtlHours', type: 'number', default: 720, description: 'How long successful live-send idempotency keys remain blocked. Default is 720 hours / 30 days.' },
    { displayName: 'Reservation TTL Minutes', name: 'reservationTtlMinutes', type: 'number', default: 15, description: 'How long an in-flight RESERVED idempotency key blocks another send if the execution stops before completion.' },
    { displayName: 'Enable Bulk Run Safety', name: 'enableBulkSafety', type: 'boolean', default: false, description: 'Enable execution-level bulk controls before real HTTP invoice sends are allowed.' },
    { displayName: 'Max Invoices Per Execution', name: 'maxInvoicesPerExecution', type: 'number', default: 100, description: 'Maximum items allowed in one Invoice Sender execution when bulk safety is enabled.' },
    { displayName: 'Require Uniform Environment', name: 'requireUniformEnvironment', type: 'boolean', default: true, description: 'Block the whole run when sandbox and live requests are mixed in the same batch.' },
    { displayName: 'Delay Between Real Sends (ms)', name: 'delayBetweenSendsMs', type: 'number', default: 0, description: 'Optional throttle between real HTTP sends. Dry runs are never delayed.' },
    { displayName: 'Max Failed Sends Before Abort', name: 'maxFailedSendsBeforeAbort', type: 'number', default: 5, description: 'Abort remaining items after this many failed real provider transports in one execution. Use 0 to disable.' },
    { displayName: 'Stop on Critical Bulk Error', name: 'stopOnCriticalBulkError', type: 'boolean', default: true, description: 'Abort remaining items after critical credential, activation, validation, or authorization failures.' },
    { displayName: 'Sandbox Bulk Confirmation', name: 'sandboxBulkConfirmation', type: 'string', default: '', description: 'For multi-item sandbox real sends, enter SEND_BULK_SANDBOX_INVOICES.' },
    { displayName: 'Live Bulk Confirmation', name: 'liveBulkConfirmation', type: 'string', default: '', description: 'For multi-item live real sends, enter SEND_BULK_REAL_INVOICES.' },
    { displayName: 'Activation Safety Mode', name: 'activationSafetyMode', type: 'options', default: 'compatibility', options: [
      { name: 'Compatibility', value: 'compatibility', description: 'Preserve the legacy Dry Run / Live Mode Confirmation behavior.' },
      { name: 'Dry Run Validation', value: 'dryRunValidation', description: 'Require Dry Run and a non-live request environment.' },
      { name: 'Sandbox Real Send', value: 'sandboxRealSend', description: 'Allow real HTTP transport only for sandbox-routed requests with sandbox confirmation.' },
      { name: 'Live Real Send', value: 'liveRealSend', description: 'Allow real HTTP transport only for live-routed requests with live confirmation.' },
    ], description: 'Explicit activation stage gate for moving from dry-run to sandbox and then live invoice sends.' },
    { displayName: 'Expected Request Environment', name: 'expectedEnvironment', type: 'options', default: 'any', options: [
      { name: 'Any', value: 'any' },
      { name: 'Sandbox', value: 'sandbox' },
      { name: 'Live', value: 'live' },
    ], description: 'Optional environment match required against readyRequest.idempotency.components.environment.' },
    { displayName: 'Sandbox Mode Confirmation', name: 'sandboxModeConfirmation', type: 'string', default: '', description: 'When Activation Safety Mode is Sandbox Real Send, enter SEND_SANDBOX_INVOICES to allow real sandbox HTTP invoice sends.' },
    { displayName: 'Stop on Transport Error', name: 'stopOnTransportError', type: 'boolean', default: false, description: 'Normally disabled so Status Checker and Status Manager can process transport failures.' },
  ],
};
