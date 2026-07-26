import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './RequestBuilder.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  group: ['transform'],
  version: 2,
  description: 'Normalize a Google Sheets row or any incoming item into a provider-independent invoice request.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    { displayName: 'Request ID Field', name: 'requestIdField', type: 'string', default: 'request_id' },
    { displayName: 'Provider Field', name: 'providerField', type: 'string', default: 'provider' },
    { displayName: 'Customer Name Field', name: 'customerNameField', type: 'string', default: 'customer_name' },
    { displayName: 'Customer Email Field', name: 'customerEmailField', type: 'string', default: 'customer_email' },
    { displayName: 'Amount Field', name: 'amountField', type: 'string', default: 'amount' },
    { displayName: 'Currency Field', name: 'currencyField', type: 'string', default: 'currency' },
    { displayName: 'Default Currency', name: 'defaultCurrency', type: 'string', default: 'USD' },
    { displayName: 'Due Date Field', name: 'dueDateField', type: 'string', default: 'due_date' },
    { displayName: 'Description Field', name: 'descriptionField', type: 'string', default: 'description' },
    { displayName: 'Line Items Field', name: 'lineItemsField', type: 'string', default: 'line_items_json' },
    { displayName: 'Metadata Field', name: 'metadataField', type: 'string', default: 'metadata_json' },
    { displayName: 'Send Email Field', name: 'sendEmailField', type: 'string', default: 'send_email' },
    {
      displayName: 'Strict Validation',
      name: 'strictValidation',
      type: 'boolean',
      default: true,
      description: 'Reject invalid email addresses, non-positive amounts, and missing request IDs.',
    },
  ],
};
