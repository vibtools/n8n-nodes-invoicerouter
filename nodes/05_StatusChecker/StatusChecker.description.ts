import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './StatusChecker.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  group: ['transform'],
  version: 1,
  description: 'Normalize an invoice or payment status.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Status Field',
      name: 'statusField',
      type: 'string',
      default: 'status',
    },
  ],
};
