import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './RequestBuilder.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  group: ['transform'],
  version: 1,
  description: 'Build a normalized invoice request from incoming data.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Customer Email Field',
      name: 'customerEmailField',
      type: 'string',
      default: 'email',
    },
    {
      displayName: 'Amount Field',
      name: 'amountField',
      type: 'string',
      default: 'amount',
    },
    {
      displayName: 'Currency',
      name: 'currency',
      type: 'string',
      default: 'USD',
    },
  ],
};
