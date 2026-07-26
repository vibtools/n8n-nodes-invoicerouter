import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './ProviderSelector.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  group: ['transform'],
  version: 2,
  description: 'Select a configured invoice provider from the incoming row or provider pool.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Strategy',
      name: 'strategy',
      type: 'options',
      default: 'inputField',
      options: [
        { name: 'Input Field', value: 'inputField' },
        { name: 'Manual', value: 'manual' },
        { name: 'First Enabled', value: 'firstEnabled' },
      ],
    },
    {
      displayName: 'Provider Field',
      name: 'providerField',
      type: 'string',
      default: 'provider',
      displayOptions: { show: { strategy: ['inputField'] } },
    },
    {
      displayName: 'Manual Provider ID',
      name: 'manualProvider',
      type: 'string',
      default: 'custom',
      displayOptions: { show: { strategy: ['manual'] } },
    },
  ],
};
