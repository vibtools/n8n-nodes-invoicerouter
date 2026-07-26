import type { INodeTypeDescription } from '../../shared/types/N8n';
import { NODE_DISPLAY_NAME, NODE_NAME } from './StatusChecker.constants';

export const description: INodeTypeDescription = {
  displayName: NODE_DISPLAY_NAME,
  name: NODE_NAME,
  group: ['transform'],
  version: 2,
  description: 'Retrieve and normalize the current invoice status from the provider API.',
  defaults: { name: NODE_DISPLAY_NAME },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'invoiceRouterApi', required: true }],
  properties: [
    {
      displayName: 'Invoice ID Field',
      name: 'invoiceIdField',
      type: 'string',
      default: 'invoice_id',
      description: 'Input field containing the provider invoice ID. invoiceResponse.invoiceId is used as a fallback.',
    },
    {
      displayName: 'Status Endpoint',
      name: 'statusEndpoint',
      type: 'string',
      default: '/invoices/{invoiceId}',
    },
    {
      displayName: 'HTTP Method',
      name: 'statusMethod',
      type: 'options',
      default: 'GET',
      options: [
        { name: 'GET', value: 'GET' },
        { name: 'POST', value: 'POST' },
      ],
    },
    {
      displayName: 'Request Body JSON',
      name: 'requestBodyJson',
      type: 'json',
      default: '{}',
      displayOptions: { show: { statusMethod: ['POST'] } },
    },
    {
      displayName: 'Extra Headers JSON',
      name: 'extraHeadersJson',
      type: 'json',
      default: '{}',
    },
    {
      displayName: 'Query Parameters JSON',
      name: 'queryJson',
      type: 'json',
      default: '{}',
    },
    {
      displayName: 'Status Response Path',
      name: 'statusPath',
      type: 'string',
      default: 'status',
    },
    {
      displayName: 'Invoice URL Response Path',
      name: 'invoiceUrlPath',
      type: 'string',
      default: 'hosted_invoice_url',
    },
    {
      displayName: 'PDF URL Response Path',
      name: 'pdfUrlPath',
      type: 'string',
      default: 'invoice_pdf',
    },
    {
      displayName: 'Dry Run',
      name: 'dryRun',
      type: 'boolean',
      default: false,
    },
    {
      displayName: 'Include Raw Response',
      name: 'includeRawResponse',
      type: 'boolean',
      default: false,
    },
  ],
};
