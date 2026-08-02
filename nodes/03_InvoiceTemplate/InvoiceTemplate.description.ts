import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './InvoiceTemplate.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, icon: 'file:invoice-router-invoice-template.svg', group: ['transform'], version: 1,
  description: 'Create and validate a reusable standard invoice structure with dynamic personalization tags.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main'], outputs: ['main'],
  properties: [
    { displayName: 'Template Mode', name: 'templateMode', type: 'options', default: 'manual', options: [
      { name: 'Manual Fields', value: 'manual' }, { name: 'Input Object', value: 'input' }, { name: 'Merge Input and Manual Defaults', value: 'merge' },
    ] },
    { displayName: 'Input Template Field', name: 'inputTemplateField', type: 'string', default: 'invoice_template', displayOptions: { show: { templateMode: ['input', 'merge'] } } },
    { displayName: 'Invoice ID', name: 'invoiceId', type: 'string', default: '#INV#', displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Invoice Number', name: 'invoiceNumber', type: 'string', default: 'INV-#INV#', displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Invoice Date', name: 'invoiceDate', type: 'string', default: '={{$now.toISODate()}}', displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Due Date', name: 'dueDate', type: 'string', default: '', displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Currency', name: 'currency', type: 'string', default: 'USD', displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Line Items JSON', name: 'lineItemsJson', type: 'json', default: '[{"name":"Service","description":"Invoice service","quantity":1,"unit_price":100}]', displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Tax', name: 'tax', type: 'number', default: 0, displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Discount', name: 'discount', type: 'number', default: 0, displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Shipping Charge', name: 'shipping', type: 'number', default: 0, displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Payment Terms', name: 'paymentTerms', type: 'string', default: 'Due on receipt', displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Invoice Notes', name: 'notes', type: 'string', default: 'Thank you, #NAME#.', displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Custom Fields JSON', name: 'customFieldsJson', type: 'json', default: '{}', displayOptions: { show: { templateMode: ['manual', 'merge'] } } },
    { displayName: 'Strict Validation', name: 'strictValidation', type: 'boolean', default: true },
  ],
};
