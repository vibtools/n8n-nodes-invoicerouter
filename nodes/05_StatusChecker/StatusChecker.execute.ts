import type { IDataObject, IExecuteFunctions, INodeExecutionData, IHttpRequestOptions } from '../../shared/types/N8n';
import {
  buildHttpOptions,
  executeApiRequest,
  normalizeCredential,
  safeResponseObject,
  type PreparedApiRequest,
} from '../../shared/http/InvoiceApi';
import { isRecord, toStringValue } from '../../shared/utils/Helpers';
import { getByPath, parseObject } from '../../shared/utils/JsonPath';

const STATUS_MAP: Record<string, string> = {
  draft: 'draft',
  created: 'draft',
  open: 'sent',
  sent: 'sent',
  delivered: 'sent',
  viewed: 'viewed',
  paid: 'paid',
  succeeded: 'paid',
  complete: 'paid',
  completed: 'paid',
  overdue: 'overdue',
  past_due: 'overdue',
  void: 'void',
  voided: 'void',
  canceled: 'void',
  cancelled: 'void',
  failed: 'failed',
  error: 'failed',
};

function normalizedStatus(value: string): string {
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (STATUS_MAP[key] ?? key) || 'unknown';
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const output: INodeExecutionData[] = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    try {
      const invoiceIdField = String(this.getNodeParameter('invoiceIdField', itemIndex, 'invoice_id'));
      const invoiceResponse = isRecord(item.json.invoiceResponse) ? item.json.invoiceResponse : {};
      const invoiceId = toStringValue(
        item.json[invoiceIdField] ?? invoiceResponse.invoiceId ?? item.json.invoiceId,
      ).trim();
      if (!invoiceId) throw new Error(`Invoice ID was not found in field "${invoiceIdField}".`);

      const statusEndpoint = String(this.getNodeParameter('statusEndpoint', itemIndex, '/invoices/{invoiceId}'));
      const statusMethod = String(this.getNodeParameter('statusMethod', itemIndex, 'GET')).toUpperCase() as IHttpRequestOptions['method'];
      const statusPath = String(this.getNodeParameter('statusPath', itemIndex, 'status'));
      const invoiceUrlPath = String(this.getNodeParameter('invoiceUrlPath', itemIndex, 'hosted_invoice_url'));
      const pdfUrlPath = String(this.getNodeParameter('pdfUrlPath', itemIndex, 'invoice_pdf'));
      const includeRawResponse = Boolean(this.getNodeParameter('includeRawResponse', itemIndex, false));
      const dryRun = Boolean(this.getNodeParameter('dryRun', itemIndex, false));
      const credential = normalizeCredential(await this.getCredentials('invoiceRouterApi', itemIndex));

      const request: PreparedApiRequest = {
        method: statusMethod,
        endpoint: statusEndpoint,
        body:
          statusMethod === 'GET'
            ? undefined
            : parseObject(this.getNodeParameter('requestBodyJson', itemIndex, '{}'), 'Request Body'),
        extraHeaders: parseObject(
          this.getNodeParameter('extraHeadersJson', itemIndex, '{}'),
          'Extra Headers',
        ),
        query: parseObject(this.getNodeParameter('queryJson', itemIndex, '{}'), 'Query Parameters'),
        variables: { invoiceId },
      };

      if (dryRun) {
        const options = buildHttpOptions(credential, request);
        output.push({
          json: {
            ...item.json,
            statusResponse: {
              success: true,
              status: 'dry_run',
              invoiceId,
              requestPlan: {
                method: options.method,
                url: options.url,
                headerNames: Object.keys(options.headers ?? {}),
                queryNames: Object.keys(options.qs ?? {}),
              },
            },
          },
          pairedItem: { item: itemIndex },
        });
        continue;
      }

      const response = await executeApiRequest(this, credential, request);
      const providerStatus = toStringValue(getByPath(response, statusPath), 'unknown');
      const statusResponse: IDataObject = {
        success: true,
        invoiceId,
        providerStatus,
        normalizedStatus: normalizedStatus(providerStatus),
        invoiceUrl: toStringValue(getByPath(response, invoiceUrlPath)) || undefined,
        pdfUrl: toStringValue(getByPath(response, pdfUrlPath)) || undefined,
        checkedAt: new Date().toISOString(),
      };
      if (includeRawResponse) statusResponse.rawResponse = safeResponseObject(response);

      output.push({
        json: { ...item.json, statusResponse },
        pairedItem: { item: itemIndex },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!this.continueOnFail()) throw new Error(`${this.getNode().name} item ${itemIndex}: ${message}`);
      output.push({
        json: {
          ...item.json,
          statusResponse: {
            success: false,
            normalizedStatus: 'failed',
            message,
            checkedAt: new Date().toISOString(),
          },
        },
        pairedItem: { item: itemIndex },
      });
    }
  }

  return [output];
}
