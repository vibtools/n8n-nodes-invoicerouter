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
    ] },
    { displayName: 'Invalid Row Policy', name: 'invalidPolicy', type: 'options', default: 'skip', options: [
      { name: 'Skip and Report', value: 'skip' }, { name: 'Stop with Error', value: 'error' },
    ] },
    { displayName: 'Preserve Custom Columns', name: 'preserveCustomColumns', type: 'boolean', default: false, description: 'Keep disabled for the v1.6 simple workflow. Enable only for advanced provider-specific routing fields.' },
    { displayName: 'Prevent Reuse in Batch', name: 'preventReuse', type: 'boolean', default: true },
  ],
};
