import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './InvoiceSender.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, group: ['transform'], version: 1,
  description: 'Execute exactly one prepared provider request and return a redacted raw execution result.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main'], outputs: ['main'],
  properties: [
    { displayName: 'Dry Run', name: 'dryRun', type: 'boolean', default: false },
    { displayName: 'Include Response Body', name: 'includeResponseBody', type: 'boolean', default: true },
    { displayName: 'Stop on Transport Error', name: 'stopOnTransportError', type: 'boolean', default: false, description: 'Normally disabled so Status Checker and Status Manager can process transport failures.' },
  ],
};
