import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './StatusChecker.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, group: ['transform'], version: 1,
  description: 'Analyze the Invoice Sender raw result and create a provider-neutral standard status object.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main'], outputs: ['main'],
  properties: [
    { displayName: 'Include Parsed Response Metadata', name: 'includeParsedMetadata', type: 'boolean', default: true },
    { displayName: 'Unknown 2xx Status', name: 'unknownSuccessStatus', type: 'string', default: 'CREATED' },
  ],
};
