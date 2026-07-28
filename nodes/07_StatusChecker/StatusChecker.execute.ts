import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { getByPath, isRecord, nowIso, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

const STATUS_MAP: Record<string, string> = {
  draft: 'DRAFT', created: 'CREATED', open: 'SENT', sent: 'SENT', delivered: 'SENT', viewed: 'VIEWED',
  pending: 'PENDING', processing: 'PROCESSING', paid: 'PAID', succeeded: 'PAID', completed: 'PAID', complete: 'PAID',
  overdue: 'OVERDUE', past_due: 'OVERDUE', void: 'CANCELLED', voided: 'CANCELLED', cancelled: 'CANCELLED', canceled: 'CANCELLED',
  failed: 'FAILED', error: 'FAILED', refunded: 'REFUNDED', partially_paid: 'PARTIALLY_PAID',
};

function normalizeStatus(value: unknown, fallback: string): string {
  const key = toStringValue(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STATUS_MAP[key] ?? (key ? key.toUpperCase() : fallback);
}

function classify(httpStatus: number, transport: string, body: unknown, message: string): string | null {
  const combined = `${message} ${JSON.stringify(body ?? '')}`.toLowerCase();
  if (transport === 'TIMEOUT' || /timeout|timed out/.test(combined)) return 'TIMEOUT_ERROR';
  if (httpStatus === 401 || /invalid token|authentication|unauthorized/.test(combined)) return 'AUTHENTICATION_ERROR';
  if (httpStatus === 403 || /forbidden|permission|authorization/.test(combined)) return 'AUTHORIZATION_ERROR';
  if (httpStatus === 429 || /rate.?limit|too many requests/.test(combined)) return 'RATE_LIMIT_ERROR';
  if ([400, 409, 422].includes(httpStatus) || /validation|invalid field|required field/.test(combined)) return 'VALIDATION_ERROR';
  if (httpStatus >= 500) return 'SERVER_ERROR';
  if (httpStatus === 0 && transport === 'ERROR') return 'NETWORK_ERROR';
  if (httpStatus >= 400) return 'PROVIDER_ERROR';
  return null;
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const output: INodeExecutionData[] = [];
  items.forEach((item, itemIndex) => {
    if (!isRecord(item.json.rawExecution)) throw new Error(`Item ${itemIndex}: Raw Execution is missing.`);
    const raw = item.json.rawExecution;
    const body = raw.responseBody;
    const paths = isRecord(raw.responsePaths) ? raw.responsePaths : {};
    const httpStatus = toFiniteNumber(raw.httpStatus, 0);
    const transport = toStringValue(raw.transportStatus, 'UNKNOWN').toUpperCase();
    const providerStatus = getByPath(body, toStringValue(paths.status, 'status'));
    const errorMessage = toStringValue(getByPath(body, toStringValue(paths.errorMessage, 'error.message')) ?? (isRecord(raw.error) ? raw.error.message : ''));
    const neutralTransport = transport === 'DRY_RUN' || transport === 'QUEUED';
    const errorType = neutralTransport ? null : classify(httpStatus, transport, body, errorMessage);
    const success = raw.success === true && httpStatus >= 200 && httpStatus < 300;
    const unknownSuccessStatus = toStringValue(this.getNodeParameter('unknownSuccessStatus', itemIndex, 'CREATED'), 'CREATED').toUpperCase();
    const invoiceStatus = neutralTransport ? 'PENDING' : normalizeStatus(providerStatus, success ? unknownSuccessStatus : 'FAILED');
    const result = transport === 'TIMEOUT' ? 'TIMEOUT' : success ? 'SUCCESS' : transport === 'ERROR' ? 'ERROR' : httpStatus ? 'FAILED' : 'UNKNOWN';
    const parsedMetadata: IDataObject = {
      invoiceId: toStringValue(getByPath(body, toStringValue(paths.invoiceId, 'id'))),
      invoiceNumber: toStringValue(getByPath(body, toStringValue(paths.invoiceNumber, 'invoice_number'))),
      invoiceUrl: toStringValue(getByPath(body, toStringValue(paths.invoiceUrl, 'hosted_invoice_url'))),
      pdfUrl: toStringValue(getByPath(body, toStringValue(paths.pdfUrl, 'invoice_pdf'))),
      transactionId: toStringValue(getByPath(body, toStringValue(paths.transactionId, 'transaction_id')) ?? raw.transactionId),
      providerReference: toStringValue(getByPath(body, 'reference') ?? getByPath(body, 'data.reference')),
    };
    const includeParsedMetadata = Boolean(this.getNodeParameter('includeParsedMetadata', itemIndex, true));
    const standardStatus: IDataObject = {
      schemaVersion: '1.0', requestId: raw.requestId, providerId: raw.providerId, profileId: raw.profileId, accountId: raw.accountId,
      workerId: raw.workerId, actionId: raw.actionId, transportStatus: transport, result, invoiceStatus, providerStatus: toStringValue(providerStatus),
      providerInvoiceId: parsedMetadata.invoiceId, invoiceNumber: parsedMetadata.invoiceNumber, httpStatus,
      errorType, errorCode: toStringValue(getByPath(body, toStringValue(paths.errorCode, 'error.code'))),
      errorMessage, latencyMs: raw.latencyMs, responseSizeBytes: raw.responseSizeBytes,
      invoiceUrl: parsedMetadata.invoiceUrl, pdfUrl: parsedMetadata.pdfUrl, transactionId: parsedMetadata.transactionId,
      parsedMetadata: includeParsedMetadata ? parsedMetadata : undefined,
      runtime: raw.runtime, checkedAt: nowIso(),
    };
    output.push({ json: { ...item.json, standardStatus }, pairedItem: { item: itemIndex } });
  });
  return [output];
}
