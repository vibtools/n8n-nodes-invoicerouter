import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './ProviderLoader.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  group: ['transform'],
  version: 1,
  description: 'Load and normalize an enabled provider pool.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Providers JSON',
      name: 'providersJson',
      type: 'json',
      default: '[]',
      description: 'JSON array of provider configuration objects',
    },
  ],
};
