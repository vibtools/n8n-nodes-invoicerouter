import type { IDataObject, IExecuteFunctions, INodeExecutionData, JsonValue } from '../../shared/types/N8n';
import { buildProviderRequest, normalizeProviderId } from '../../providers';
import { buildDynamicTags, replaceTags } from '../../shared/utils/Template';
import { isRecord, parseJsonObject, slug, toStringValue } from '../../shared/utils/Helpers';

function itemAt(items: INodeExecutionData[], index: number): INodeExecutionData | undefined {
  return items[index] ?? items[0];
}

function safeRecord(value: JsonValue | undefined, label: string): IDataObject {
  if (!isRecord(value)) throw new Error(`${label} is missing or invalid.`);
  return value;
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const allocationItems = this.getInputData(0);
  const templateItems = this.getInputData(1);
  const recipientItems = this.getInputData(2);
  if (allocationItems.length === 0) throw new Error('Provider Selector input is empty. Connect Provider Selector to input 1.');
  if (templateItems.length === 0) throw new Error('Invoice Template input is empty. Connect Invoice Template to input 2.');
  if (recipientItems.length === 0) throw new Error('Email List input is empty. Connect Email List to input 3.');

  const strictWarnings = Boolean(this.getNodeParameter('strictProviderWarnings', 0, false));
  const customBody = parseJsonObject(this.getNodeParameter('customBodyJson', 0, '{}'), 'Custom Body Override');
  const extraHeaders = parseJsonObject(this.getNodeParameter('extraHeadersJson', 0, '{}'), 'Extra Headers');
  const extraQuery = parseJsonObject(this.getNodeParameter('extraQueryJson', 0, '{}'), 'Extra Query');
  const idempotencyHeader = toStringValue(this.getNodeParameter('idempotencyHeader', 0, 'Idempotency-Key'));
  const allowHttp = Boolean(this.getNodeParameter('allowHttp', 0, false));
  const output: INodeExecutionData[] = [];

  recipientItems.forEach((recipientItem, itemIndex) => {
    const allocationItem = itemAt(allocationItems, itemIndex);
    const templateItem = itemAt(templateItems, itemIndex);
    const recipient = safeRecord(recipientItem.json.recipient, 'Recipient');
    const allocation = safeRecord(allocationItem?.json.providerAllocation, 'Provider allocation');
    if (toStringValue(allocation.status) === 'QUEUED') {
      output.push({ json: { ...recipientItem.json, requestBuild: { success: false, status: 'QUEUED', message: 'No provider account is currently available.', allocation } }, pairedItem: { item: itemIndex, input: 2 } });
      return;
    }
    const template = safeRecord(templateItem?.json.invoiceTemplate, 'Invoice template');
    const providerId = normalizeProviderId(allocation.providerId ?? allocation.providerName);
    const profileId = toStringValue(allocation.id);
    const accountId = toStringValue(allocation.accountId);
    const workerId = toStringValue(allocation.workerId ?? (isRecord(allocation.runtime) && isRecord(allocation.runtime.lock) ? allocation.runtime.lock.workerId : ''), `worker-${itemIndex + 1}`);
    const executionId = toStringValue((allocationItem?.json.runtime && isRecord(allocationItem.json.runtime)) ? allocationItem.json.runtime.executionId : '');
    const tags = buildDynamicTags(`${executionId}:${profileId}:${toStringValue(recipient.email)}:${itemIndex}`, recipient, allocation);
    const resolvedTemplateValue = replaceTags(template, tags);
    const invoice = safeRecord(resolvedTemplateValue, 'Resolved invoice template');
    const build = buildProviderRequest({ providerId, actionId: toStringValue(allocation.actionId), invoice, recipient, profile: allocation });
    const resolvedCustomBody = replaceTags(customBody, tags);
    const body: JsonValue = Object.keys(customBody).length > 0 ? resolvedCustomBody : build.body;
    if (strictWarnings && build.warnings.length > 0) throw new Error(build.warnings.join(' '));

    const baseUrl = toStringValue(allocation.baseUrl).replace(/\/+$/, '');
    const endpoint = toStringValue(allocation.endpoint);
    if (!baseUrl || !endpoint) throw new Error(`Provider profile ${profileId} has no Base URL or Endpoint.`);
    const url = `${baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    const parsed = new URL(url.replace(/\{[^}]+\}/g, 'placeholder'));
    const localhost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(allowHttp || localhost)) throw new Error('Provider URL must use HTTPS. Enable Allow HTTP only for a trusted development endpoint.');

    const headers: IDataObject = {
      Accept: 'application/json',
      'Content-Type': toStringValue(allocation.contentType, 'application/json'),
      ...(replaceTags(extraHeaders, tags) as IDataObject),
    };
    const requestId = toStringValue(invoice.invoiceId, tags.INV);
    const query: IDataObject = { ...build.query, ...(replaceTags(extraQuery, tags) as IDataObject) };
    const readyRequest: IDataObject = {
      schemaVersion: '1.0', requestId, transactionId: toStringValue(invoice.transactionId, tags.TRX),
      providerId, profileId, accountId, workerId, actionId: toStringValue(allocation.actionId), actionName: toStringValue(allocation.actionName),
      method: toStringValue(allocation.method, 'POST'), baseUrl, endpoint, url, headers, query, body,
      contentType: toStringValue(allocation.contentType, 'application/json'), timeoutMs: allocation.timeoutMs ?? 60_000,
      credentialRef: toStringValue(allocation.credentialRef), authType: toStringValue(allocation.authType),
      idempotency: { header: idempotencyHeader, value: requestId }, responsePaths: build.responsePaths,
      invoice, recipient, warnings: build.warnings,
      runtime: { scopeKey: toStringValue(allocation.scopeKey ?? (isRecord(allocationItem?.json.runtime) ? allocationItem?.json.runtime.scopeKey : '')), lock: isRecord(allocation.runtime) ? allocation.runtime.lock : null },
      preparedAt: new Date().toISOString(),
    };
    output.push({
      json: { readyRequest, requestBuild: { success: true, providerId, profileId, accountId, requestId, warningCount: build.warnings.length } },
      pairedItem: [{ item: Math.min(itemIndex, allocationItems.length - 1), input: 0 }, { item: Math.min(itemIndex, templateItems.length - 1), input: 1 }, { item: itemIndex, input: 2 }],
    });
  });
  return [output];
}
