import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './ProviderSelector.constants';
export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME, name: NODE_NAME, icon: 'file:invoice-router-provider-selector.svg', group: ['transform'], version: 1,
  description: 'Allocate and lock one eligible provider account for every incoming work item, with optional per-item conditional routing.',
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
    { displayName: 'Provider Filter', name: 'providerFilter', type: 'string', default: '', description: 'Optional provider ID/name. Blank allows every provider unless conditional routing sets a provider for the item.' },
    { displayName: 'Action Filter', name: 'actionFilter', type: 'string', default: '', description: 'Optional action name/ID. Blank allows every action unless conditional routing sets an action for the item.' },
    { displayName: 'Environment Filter', name: 'environmentFilter', type: 'string', default: '', description: 'Optional live/sandbox filter. Production templates should normally use live or sandbox explicitly.' },
    { displayName: 'Conditional Routing', name: 'conditionalRouting', type: 'boolean', default: false, description: 'Route each work item by matching routing rules first, then Provider/Action/Environment fields from the item.' },
    { displayName: 'Routing Rules JSON', name: 'routingRulesJson', type: 'json', default: '[]', description: 'Optional first-match rules. Example: [{"name":"US Stripe","when":{"recipient.customFields.Country":["US","CA"]},"provider":"Stripe","action":"Create Invoice","environment":"Live"}].' },
    { displayName: 'Provider Field Path', name: 'routeProviderPath', type: 'string', default: 'recipient.customFields.Provider', description: 'Item path used when no routing rule matches. Example: recipient.customFields.Provider.' },
    { displayName: 'Action Field Path', name: 'routeActionPath', type: 'string', default: 'recipient.customFields.Action', description: 'Item path used when no routing rule matches. Example: recipient.customFields.Action.' },
    { displayName: 'Environment Field Path', name: 'routeEnvironmentPath', type: 'string', default: 'recipient.customFields.Environment', description: 'Item path used when no routing rule matches. Example: recipient.customFields.Environment.' },
    { displayName: 'Require Conditional Match', name: 'requireConditionalMatch', type: 'boolean', default: false, description: 'When enabled, items without a matching rule or routing fields are blocked before Request Builder.' },
    { displayName: 'Unmatched Route Behavior', name: 'unmatchedRouteBehavior', type: 'options', default: 'block', options: [
      { name: 'Block Item', value: 'block', description: 'Return a BLOCKED allocation so downstream status nodes can record a guarded skip.' },
      { name: 'Throw Error', value: 'error', description: 'Stop execution immediately when a required route is missing.' },
    ] },
    { displayName: 'Queue When Unavailable', name: 'queueWhenUnavailable', type: 'boolean', default: true },
    { displayName: 'Lock Timeout (seconds)', name: 'lockTimeoutSeconds', type: 'number', default: 300 },
    { displayName: 'Max Requests per Account per Minute', name: 'maxRequestsPerMinute', type: 'number', default: 60 },
    { displayName: 'Circuit Breaker Failure Threshold', name: 'circuitBreakerThreshold', type: 'number', default: 5 },
  ],
};
