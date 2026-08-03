import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './ProviderLoader.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  icon: 'file:invoice-router-provider-loader.svg',
  group: ['transform'],
  version: 1,
  description: 'Validate and normalize Google Sheets provider account/action rows into a masked runtime provider library.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    { displayName: 'Batch ID', name: 'batchId', type: 'string', default: 'default', description: 'Profiles, locks, and recipient reservations share this batch boundary.' },
    { displayName: 'Source Sheet Name', name: 'sourceName', type: 'string', default: 'provider' },
    {
      displayName: 'Duplicate Profile Policy', name: 'duplicatePolicy', type: 'options', default: 'error',
      options: [
        { name: 'Stop with Error', value: 'error' },
        { name: 'Keep First and Warn', value: 'first' },
        { name: 'Keep Last and Warn', value: 'last' },
      ],
    },
    { displayName: 'Include Disabled Profiles', name: 'includeDisabled', type: 'boolean', default: false },
    { displayName: 'Strict Validation', name: 'strictValidation', type: 'boolean', default: true, description: 'Stop when an enabled row is incomplete. Disable to skip invalid rows with warnings.' },
    { displayName: 'Enable Odoo Read-Only Preflight', name: 'enableOdooPreflight', type: 'boolean', default: false, description: 'Authenticate each enabled Odoo account and verify currency/model access before any invoice job is allocated.' },
    { displayName: 'Preflight Currency', name: 'preflightCurrency', type: 'string', default: 'USD', displayOptions: { show: { enableOdooPreflight: [true] } }, description: 'Must match the Invoice Template currency for the canonical Odoo workflow.' },
    { displayName: 'Preflight Permission Checks', name: 'preflightCheckPermissions', type: 'boolean', default: true, displayOptions: { show: { enableOdooPreflight: [true] } }, description: 'Verify read/create access for customer, invoice, and invoice send wizard models.' },
    { displayName: 'Preflight Failure Policy', name: 'preflightFailurePolicy', type: 'options', default: 'excludeAndReport', displayOptions: { show: { enableOdooPreflight: [true] } }, options: [
      { name: 'Exclude Account and Report', value: 'excludeAndReport' },
      { name: 'Stop Workflow with Error', value: 'error' },
    ] },
  ],
};
