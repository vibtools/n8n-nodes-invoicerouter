import type { ICredentialType, INodeProperty } from '../shared/types/N8n';

export class InvoiceRouterApi implements ICredentialType {
  name = 'invoiceRouterApi';
  displayName = 'InvoiceRouter API';
  documentationUrl = 'https://github.com/vibtools/n8n-nodes-invoicerouter';

  properties: INodeProperty[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'https://api.example.com/v1',
      description: 'Provider API base URL. Use HTTPS in production.',
    },
    {
      displayName: 'Authentication',
      name: 'authType',
      type: 'options',
      default: 'bearer',
      options: [
        { name: 'Bearer Token', value: 'bearer' },
        { name: 'API Key Header', value: 'header' },
        { name: 'Basic Auth', value: 'basic' },
        { name: 'API Key Query Parameter', value: 'query' },
        { name: 'None', value: 'none' },
      ],
    },
    {
      displayName: 'Bearer Token',
      name: 'bearerToken',
      type: 'string',
      default: '',
      typeOptions: { password: true },
      displayOptions: { show: { authType: ['bearer'] } },
    },
    {
      displayName: 'API Key Header',
      name: 'apiKeyHeader',
      type: 'string',
      default: 'X-API-Key',
      displayOptions: { show: { authType: ['header'] } },
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      default: '',
      typeOptions: { password: true },
      displayOptions: { show: { authType: ['header', 'query'] } },
    },
    {
      displayName: 'Query Key Name',
      name: 'queryKeyName',
      type: 'string',
      default: 'api_key',
      displayOptions: { show: { authType: ['query'] } },
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      displayOptions: { show: { authType: ['basic'] } },
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      default: '',
      typeOptions: { password: true },
      displayOptions: { show: { authType: ['basic'] } },
    },
    {
      displayName: 'Default Headers JSON',
      name: 'defaultHeaders',
      type: 'json',
      default: '{}',
      description: 'Additional headers applied to every provider request. Do not place secrets here unless necessary.',
    },
    {
      displayName: 'Timeout (ms)',
      name: 'timeoutMs',
      type: 'number',
      default: 30000,
      description: 'Request timeout in milliseconds.',
    },
    {
      displayName: 'Allow HTTP',
      name: 'allowHttp',
      type: 'boolean',
      default: false,
      description: 'Allow an unencrypted HTTP Base URL. Keep disabled in production.',
    },
  ];
}
