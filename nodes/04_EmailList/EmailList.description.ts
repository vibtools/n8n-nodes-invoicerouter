import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './EmailList.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, icon: 'file:invoice-router-email-list.svg', group: ['transform'], version: 1,
  description: 'Normalize a simple bulk email list. Email is required; Name and Address are optional; missing names are generated from the email username.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main'], outputs: ['main'],
  properties: [
    { displayName: 'Batch ID', name: 'batchId', type: 'string', default: 'default' },
    { displayName: 'Email Field', name: 'emailField', type: 'string', default: 'Email' },
    { displayName: 'Name Field', name: 'nameField', type: 'string', default: 'Name' },
    { displayName: 'Address Field', name: 'addressField', type: 'string', default: 'Address', description: 'Optional recipient address column. Leave cells blank when address is not needed.' },
    { displayName: 'Name Generation', name: 'nameGeneration', type: 'options', default: 'formatted', options: [
      { name: 'Username', value: 'username' }, { name: 'Formatted Username', value: 'formatted' }, { name: 'First Word', value: 'firstWord' },
      { name: 'Custom Fixed Name', value: 'customFixed', description: 'Use one configured customer name for every invoice in this run.' },
    ] },
    { displayName: 'Fixed Customer Name', name: 'fixedCustomerName', type: 'string', default: '', required: true,
      displayOptions: { show: { nameGeneration: ['customFixed'] } }, description: 'Used for every recipient when Name Generation is Custom Fixed Name.' },
    { displayName: 'Status Field', name: 'statusField', type: 'string', default: 'status', description: 'Managed email_list status column.' },
    { displayName: 'Job ID Field', name: 'jobIdField', type: 'string', default: 'Job_ID', description: 'Durable job identifier column. Blank values are generated deterministically.' },
    { displayName: 'Campaign ID Field', name: 'campaignIdField', type: 'string', default: 'Campaign_ID', description: 'Campaign identifier column used for restart-safe idempotency.' },
    { displayName: 'Default Campaign ID', name: 'defaultCampaignId', type: 'string', default: 'default-campaign', description: 'Used when Campaign_ID is blank.' },
    { displayName: 'Invalid Row Policy', name: 'invalidPolicy', type: 'options', default: 'skip', options: [
      { name: 'Skip and Report', value: 'skip' }, { name: 'Stop with Error', value: 'error' },
    ] },
    { displayName: 'Preserve Custom Columns', name: 'preserveCustomColumns', type: 'boolean', default: false, description: 'Keep disabled for the v1.6 simple workflow. Enable only for advanced provider-specific routing fields.' },
    { displayName: 'Prevent Reuse in Batch', name: 'preventReuse', type: 'boolean', default: true },
    { displayName: 'Enable Campaign Safety', name: 'enableCampaignSafety', type: 'boolean', default: false, description: 'Enforce campaign-wide item limits, failure pause, inter-send delay, and live bulk confirmation across one-item workflow loops.' },
    { displayName: 'Max Invoices Per Execution', name: 'campaignMaxInvoices', type: 'number', default: 100, displayOptions: { show: { enableCampaignSafety: [true] } } },
    { displayName: 'Max Failed Sends Before Pause', name: 'campaignMaxFailures', type: 'number', default: 5, displayOptions: { show: { enableCampaignSafety: [true] } } },
    { displayName: 'Delay Between Sends (ms)', name: 'campaignDelayBetweenSendsMs', type: 'number', default: 500, displayOptions: { show: { enableCampaignSafety: [true] } } },
    { displayName: 'Stop Campaign on Critical Error', name: 'campaignStopOnCriticalError', type: 'boolean', default: true, displayOptions: { show: { enableCampaignSafety: [true] } } },
    { displayName: 'Require Live Bulk Confirmation', name: 'requireLiveBulkConfirmation', type: 'boolean', default: true, displayOptions: { show: { enableCampaignSafety: [true] } } },
    { displayName: 'Live Bulk Confirmation', name: 'liveBulkConfirmation', type: 'string', default: '', placeholder: 'SEND_BULK_REAL_INVOICES', displayOptions: { show: { enableCampaignSafety: [true], requireLiveBulkConfirmation: [true] } }, description: 'Required only when more than one eligible recipient is processed. Enter SEND_BULK_REAL_INVOICES.' },
  ],
};
