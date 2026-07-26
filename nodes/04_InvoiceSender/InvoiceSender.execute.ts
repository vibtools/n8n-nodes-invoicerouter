import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  IHttpRequestOptions,
  JsonValue,
} from '../../shared/types/N8n';
import {
  buildHttpOptions,
  executeApiRequest,
  normalizeCredential,
  safeResponseObject,
  type PreparedApiRequest,
} from '../../shared/http/InvoiceApi';
import { isRecord, toStringValue } from '../../shared/utils/Helpers';
import { getByPath, parseObject } from '../../shared/utils/JsonPath';

function method(
  context: IExecuteFunctions,
  name: string,
  itemIndex: number,
  fallback: IHttpRequestOptions['method'],
): IHttpRequestOptions['method'] {
  return String(context.getNodeParameter(name, itemIndex, fallback)).toUpperCase() as IHttpRequestOptions['method'];
}

function stringParameter(context: IExecuteFunctions, name: string, itemIndex: number, fallback: string): string {
  return String(context.getNodeParameter(name, itemIndex, fallback));
}

function selectedProvider(item: IDataObject, manual: string, source: string): string {
  if (source === 'manual') return manual.trim().toLowerCase() || 'custom';
  if (isRecord(item.selectedProvider)) {
    return toStringValue(item.selectedProvider.id ?? item.selectedProvider.name, 'custom').trim().toLowerCase();
  }
  if (isRecord(item.invoice)) return toStringValue(item.invoice.provider, 'custom').trim().toLowerCase();
  return toStringValue(item.provider, 'custom').trim().toLowerCase();
}

function responseString(response: unknown, path: string, fallback = ''): string {
  const value = getByPath(response, path);
  return toStringValue(value, fallback);
}

function requestVariables(invoice: IDataObject, provider: string, invoiceId = ''): Record<string, string> {
  const values: Record<string, string> = {
    provider,
    invoiceId,
    requestId: toStringValue(invoice.requestId),
    customerEmail: toStringValue(invoice.customerEmail),
    customerName: toStringValue(invoice.customerName),
    currency: toStringValue(invoice.currency),
    amount: toStringValue(invoice.amount),
  };
  for (const [key, value] of Object.entries(invoice)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      values[`invoice.${key}`] = String(value);
    }
  }
  return values;
}

function sanitizedPlan(options: IHttpRequestOptions): IDataObject {
  const headerNames = Object.keys(options.headers ?? {});
  return {
    method: options.method,
    url: options.url,
    headerNames,
    queryNames: Object.keys(options.qs ?? {}),
    body: (options.body ?? null) as JsonValue,
    timeout: options.timeout ?? 30000,
  };
}

function normalizeOutput(
  provider: string,
  operation: string,
  requestId: string,
  response: unknown,
  paths: { invoiceId: string; status: string; invoiceUrl: string; pdfUrl: string; message: string },
  includeRawResponse: boolean,
  fallbackInvoiceId = '',
): IDataObject {
  const invoiceId = responseString(response, paths.invoiceId, fallbackInvoiceId);
  const status = responseString(response, paths.status, operation === 'create' ? 'created' : 'sent');
  const message = responseString(response, paths.message, 'Provider request completed successfully.');
  const output: IDataObject = {
    success: true,
    provider,
    operation,
    requestId,
    invoiceId: invoiceId || undefined,
    status,
    message,
    invoiceUrl: responseString(response, paths.invoiceUrl) || undefined,
    pdfUrl: responseString(response, paths.pdfUrl) || undefined,
    completedAt: new Date().toISOString(),
  };
  if (includeRawResponse) output.rawResponse = safeResponseObject(response);
  return output;
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const output: INodeExecutionData[] = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    try {
      const operation = stringParameter(this, 'operation', itemIndex, 'createAndSend');
      const providerSource = stringParameter(this, 'providerSource', itemIndex, 'input');
      const manualProvider = stringParameter(this, 'provider', itemIndex, 'custom');
      const provider = selectedProvider(item.json, manualProvider, providerSource);
      const dryRun = Boolean(this.getNodeParameter('dryRun', itemIndex, true));
      const includeRawResponse = Boolean(this.getNodeParameter('includeRawResponse', itemIndex, false));
      const invoice = isRecord(item.json.invoice) ? item.json.invoice : item.json;
      const requestId = toStringValue(invoice.requestId, `item-${itemIndex + 1}`);
      const credentials = normalizeCredential(await this.getCredentials('invoiceRouterApi', itemIndex));
      const extraHeaders = parseObject(this.getNodeParameter('extraHeadersJson', itemIndex, '{}'), 'Extra Headers');
      const query = parseObject(this.getNodeParameter('queryJson', itemIndex, '{}'), 'Query Parameters');
      const idempotencyHeader = stringParameter(this, 'idempotencyHeader', itemIndex, 'Idempotency-Key').trim();
      if (idempotencyHeader && requestId) extraHeaders[idempotencyHeader] = requestId;

      const paths = {
        invoiceId: stringParameter(this, 'invoiceIdPath', itemIndex, 'id'),
        status: stringParameter(this, 'statusPath', itemIndex, 'status'),
        invoiceUrl: stringParameter(this, 'invoiceUrlPath', itemIndex, 'hosted_invoice_url'),
        pdfUrl: stringParameter(this, 'pdfUrlPath', itemIndex, 'invoice_pdf'),
        message: stringParameter(this, 'messagePath', itemIndex, 'message'),
      };

      let finalResponse: unknown = null;
      let invoiceId = '';
      const plans: IDataObject[] = [];

      if (operation === 'create' || operation === 'createAndSend') {
        const bodyMode = stringParameter(this, 'createBodyMode', itemIndex, 'invoice');
        const body = bodyMode === 'raw'
          ? parseObject(this.getNodeParameter('createBodyJson', itemIndex, '{}'), 'Create Body')
          : invoice;
        const createRequest: PreparedApiRequest = {
          method: method(this, 'createMethod', itemIndex, 'POST'),
          endpoint: stringParameter(this, 'createEndpoint', itemIndex, '/invoices'),
          body,
          extraHeaders,
          query,
          variables: requestVariables(invoice, provider),
        };

        if (dryRun) {
          plans.push(sanitizedPlan(buildHttpOptions(credentials, createRequest)));
        } else {
          finalResponse = await executeApiRequest(this, credentials, createRequest);
          invoiceId = responseString(finalResponse, paths.invoiceId);
          if (!invoiceId && operation === 'createAndSend') {
            throw new Error(`Create response did not contain an invoice ID at path "${paths.invoiceId}".`);
          }
        }
      }

      if (operation === 'send' || operation === 'createAndSend') {
        if (operation === 'send') {
          const existingField = stringParameter(this, 'existingInvoiceIdField', itemIndex, 'invoice_id');
          invoiceId = toStringValue(item.json[existingField] ?? invoice.invoiceId ?? item.json.invoiceId).trim();
          if (!invoiceId) throw new Error(`Existing invoice ID was not found in field "${existingField}".`);
        }
        const sendRequest: PreparedApiRequest = {
          method: method(this, 'sendMethod', itemIndex, 'POST'),
          endpoint: stringParameter(this, 'sendEndpoint', itemIndex, '/invoices/{invoiceId}/send'),
          body: parseObject(this.getNodeParameter('sendBodyJson', itemIndex, '{}'), 'Send Body'),
          extraHeaders,
          query,
          variables: requestVariables(invoice, provider, invoiceId),
        };

        if (dryRun) {
          plans.push(sanitizedPlan(buildHttpOptions(credentials, sendRequest)));
        } else {
          finalResponse = await executeApiRequest(this, credentials, sendRequest);
        }
      }

      if (operation === 'custom') {
        const customRequest: PreparedApiRequest = {
          method: method(this, 'customMethod', itemIndex, 'POST'),
          endpoint: stringParameter(this, 'customEndpoint', itemIndex, '/'),
          body: parseObject(this.getNodeParameter('customBodyJson', itemIndex, '{}'), 'Custom Body'),
          extraHeaders,
          query,
          variables: requestVariables(invoice, provider),
        };

        if (dryRun) plans.push(sanitizedPlan(buildHttpOptions(credentials, customRequest)));
        else finalResponse = await executeApiRequest(this, credentials, customRequest);
      }

      const invoiceResponse = dryRun
        ? {
            success: true,
            provider,
            operation,
            requestId,
            status: 'dry_run',
            message: 'Dry run completed. No provider request was sent.',
            requestPlans: plans,
          }
        : normalizeOutput(
            provider,
            operation,
            requestId,
            finalResponse,
            paths,
            includeRawResponse,
            invoiceId,
          );

      output.push({
        json: { ...item.json, invoiceResponse },
        pairedItem: { item: itemIndex },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!this.continueOnFail()) throw new Error(`${this.getNode().name} item ${itemIndex}: ${message}`);
      output.push({
        json: {
          ...item.json,
          invoiceResponse: {
            success: false,
            status: 'failed',
            message,
            failedAt: new Date().toISOString(),
          },
        },
        pairedItem: { item: itemIndex },
      });
    }
  }

  return [output];
}
