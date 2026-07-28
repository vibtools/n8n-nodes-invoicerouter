import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './ProviderSelector.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, group: ['transform'], version: 1,
  description: 'Allocate and lock one eligible provider account for every incoming work item.',
  defaults: { name: NODE_DISPLAY_NAME }, inputs: ['main', 'main'], outputs: ['main'],
  properties: [
    { displayName: 'Processing Mode', name: 'processingMode', type: 'options', default: 'sequential', options: [
      { name: 'Sequential (Beginner Friendly)', value: 'sequential', description: 'Allows an account to be reused safely because Invoice Sender processes items in order.' },
      { name: 'Parallel Locks', value: 'parallel', description: 'Keeps every allocation locked until Status Manager feedback; requires enough accounts or queue handling.' },
    ] },
    { displayName: 'Allocation Strategy', name: 'strategy', type: 'options', default: 'firstAvailable', options: [
      { name: 'First Available', value: 'firstAvailable' }, { name: 'Round Robin', value: 'roundRobin' },
      { name: 'Least Recently Used', value: 'leastRecentlyUsed' }, { name: 'Least Busy', value: 'leastBusy' },
      { name: 'Highest Health Score', value: 'highestHealth' }, { name: 'Weighted Distribution', value: 'weighted' },
    ] },
    { displayName: 'Provider Filter', name: 'providerFilter', type: 'string', default: '', description: 'Optional provider ID/name. Blank allows every provider.' },
    { displayName: 'Action Filter', name: 'actionFilter', type: 'string', default: '', description: 'Optional action name/ID.' },
    { displayName: 'Environment Filter', name: 'environmentFilter', type: 'string', default: '', description: 'Optional live/sandbox filter.' },
    { displayName: 'Queue When Unavailable', name: 'queueWhenUnavailable', type: 'boolean', default: true },
    { displayName: 'Lock Timeout (seconds)', name: 'lockTimeoutSeconds', type: 'number', default: 300 },
    { displayName: 'Max Requests per Account per Minute', name: 'maxRequestsPerMinute', type: 'number', default: 60 },
    { displayName: 'Circuit Breaker Failure Threshold', name: 'circuitBreakerThreshold', type: 'number', default: 5 },
  ],
};
