import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './ProviderSelector.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  group: ['transform'],
  version: 1,
  description: 'Select a provider from an input provider pool.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Strategy',
      name: 'strategy',
      type: 'options',
      default: 'firstEnabled',
      options: [
        { name: 'First Enabled', value: 'firstEnabled' },
        { name: 'Manual', value: 'manual' },
      ],
    },
    {
      displayName: 'Manual Provider ID',
      name: 'manualProvider',
      type: 'string',
      default: '',
    },
  ],
};
