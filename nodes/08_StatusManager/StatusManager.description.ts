import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './StatusManager.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, group: ['transform'], version: 1,
  description: 'Apply policy, create retry/metrics/alert/audit events, and update provider runtime feedback.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main'], outputs: ['main'],
  properties: [
    { displayName: 'Retry Limit', name: 'retryLimit', type: 'number', default: 3 },
    { displayName: 'Retry Base Delay (seconds)', name: 'retryBaseDelaySeconds', type: 'number', default: 30 },
    { displayName: 'Default Cooldown (seconds)', name: 'cooldownSeconds', type: 'number', default: 30 },
    { displayName: 'Disable Account on Authentication Failure', name: 'disableOnAuthFailure', type: 'boolean', default: true },
    { displayName: 'Create Alert on Failure', name: 'alertOnFailure', type: 'boolean', default: true },
    { displayName: 'Include Management Events', name: 'includeEvents', type: 'boolean', default: true },
  ],
};
