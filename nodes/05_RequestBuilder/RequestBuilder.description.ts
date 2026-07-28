import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './RequestBuilder.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, group: ['transform'], version: 1,
  description: 'Merge one allocated account, one invoice template, and one recipient into a ready-to-send provider request.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main', 'main', 'main'], outputs: ['main'],
  properties: [
    { displayName: 'Strict Provider Warnings', name: 'strictProviderWarnings', type: 'boolean', default: false, description: 'Stop when a provider preset reports missing provider-specific IDs.' },
    { displayName: 'Custom Body Override JSON', name: 'customBodyJson', type: 'json', default: '{}', description: 'Optional complete body override. Leave {} to use the built-in provider preset.' },
    { displayName: 'Extra Headers JSON', name: 'extraHeadersJson', type: 'json', default: '{}' },
    { displayName: 'Extra Query JSON', name: 'extraQueryJson', type: 'json', default: '{}' },
    { displayName: 'Idempotency Header', name: 'idempotencyHeader', type: 'string', default: 'Idempotency-Key' },
    { displayName: 'Allow HTTP URL', name: 'allowHttp', type: 'boolean', default: false, description: 'Keep disabled in production. Localhost HTTP is always allowed.' },
  ],
};
