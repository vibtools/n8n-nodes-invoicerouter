import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './InvoiceSender.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  group: ['transform'],
  version: 1,
  description: 'Prepare a standardized provider send result in safe dry-run mode.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Dry Run',
      name: 'dryRun',
      type: 'boolean',
      default: true,
      description: 'Prepare a standardized result without calling a provider API',
    },
  ],
};
