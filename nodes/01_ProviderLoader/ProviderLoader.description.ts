import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './ProviderLoader.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  group: ['transform'],
  version: 2,
  description: 'Load the built-in provider registry and optional custom endpoint profiles.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Include Built-In Providers',
      name: 'includeBuiltIns',
      type: 'boolean',
      default: true,
      description: 'Include supported provider identifiers for routing. API endpoint configuration remains explicit.',
    },
    {
      displayName: 'Custom Providers JSON',
      name: 'providersJson',
      type: 'json',
      default: '[]',
      description: 'Optional JSON array of provider endpoint profiles. Never store API secrets in this field.',
    },
  ],
};
