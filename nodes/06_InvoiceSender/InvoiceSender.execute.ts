import type { IDataObject, IExecuteFunctions, INodeExecutionData, IHttpRequestOptions, JsonValue } from '../../shared/types/N8n';
import { getSecretMaterial } from '../../shared/runtime/RuntimeStore';
import { redactJson, redactString, secretValues } from '../../shared/security/Redaction';
import { isRecord, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

function secretVariables(secret: { apiKey: string; apiSecret: string; extraValue: string }): Record<string, string> {
  const variables: Record<string, string> = {
    API_KEY: secret.apiKey, ACCESS_TOKEN: secret.apiKey, API_SECRET: secret.apiSecret, EXTRA_VALUE: secret.extraValue,
    SESSION_ID: secret.extraValue, BASE64_KEY_SECRET: globalThis.btoa(`${secret.apiKey}:${secret.apiSecret}`),
    realmId: secret.extraValue, accountId: secret.extraValue, organizationId: secret.extraValue, tenantId: secret.extraValue, site: secret.extraValue,
  };
  try {
    const parsed: unknown = JSON.parse(secret.extraValue);
    if (isRecord(parsed)) for (const [key, value] of Object.entries(parsed)) variables[key] = toStringValue(value);
  } catch { /* Extra Value may intentionally be plain text. */ }
  return variables;
}

function interpolate(value: string, variables: Record<string, string>): string {
  return value
    .replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => variables[key] ?? '')
    .replace(/\{([^}]+)\}/g, (_match, key: string) => variables[key] ?? `{${key}}`);
}

function interpolateJson(value: JsonValue, variables: Record<string, string>): JsonValue {
  if (typeof value === 'string') return interpolate(value, variables);
  if (Array.isArray(value)) return value.map((entry) => interpolateJson(entry, variables));
  if (isRecord(value)) {
    const output: IDataObject = {};
    for (const [key, entry] of Object.entries(value)) output[key] = entry === undefined ? undefined : interpolateJson(entry, variables);
    return output;
  }
  return value;
}

function formPairs(value: JsonValue, prefix = '', output: Array<[string, string]> = []): Array<[string, string]> {
  if (Array.isArray(value)) value.forEach((entry, index) => formPairs(entry, `${prefix}[${index}]`, output));
  else if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) if (entry !== undefined) formPairs(entry, prefix ? `${prefix}[${key}]` : key, output);
  } else if (value !== undefined && value !== null) output.push([prefix, toStringValue(value)]);
  return output;
}

function parseResponseBody(value: unknown): JsonValue {
  if (typeof value !== 'string') return (value ?? null) as JsonValue;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try { return JSON.parse(trimmed) as JsonValue; } catch { return value; }
}

function responseParts(response: unknown): { statusCode: number; headers: IDataObject; body: JsonValue } {
  if (isRecord(response) && ('statusCode' in response || 'body' in response)) {
    return {
      statusCode: toFiniteNumber(response.statusCode, 0),
      headers: isRecord(response.headers) ? response.headers : {},
      body: parseResponseBody(response.body),
    };
  }
  return { statusCode: 200, headers: {}, body: parseResponseBody(response) };
}

function byteSize(value: unknown): number {
  try { return new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length; } catch { return 0; }
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const output: INodeExecutionData[] = [];
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const startedAt = new Date();
    const started = Date.now();
    const dryRun = Boolean(this.getNodeParameter('dryRun', itemIndex, false));
    const includeResponseBody = Boolean(this.getNodeParameter('includeResponseBody', itemIndex, true));
    const stopOnTransportError = Boolean(this.getNodeParameter('stopOnTransportError', itemIndex, false));
    let activeSecrets: string[] = [];
    try {
      if (!isRecord(item.json.readyRequest)) {
        const build = isRecord(item.json.requestBuild) ? item.json.requestBuild : {};
        if (toStringValue(build.status).toUpperCase() === 'QUEUED') {
          const allocation = isRecord(build.allocation) ? build.allocation : {};
          output.push({ json: { ...item.json, rawExecution: {
            schemaVersion: '1.0', success: false, transportStatus: 'QUEUED', requestId: '', providerId: allocation.providerId,
            profileId: allocation.id, accountId: allocation.accountId, workerId: allocation.workerId, httpStatus: 0,
            responseHeaders: {}, responseBody: null, latencyMs: 0, responseSizeBytes: 0,
            queueReason: toStringValue(build.message, 'No provider account is currently available.'),
            startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), runtime: { scopeKey: allocation.scopeKey },
          } }, pairedItem: { item: itemIndex } });
          continue;
        }
        throw new Error('Ready Request is missing.');
      }
      const request = item.json.readyRequest;
      const credentialRef = toStringValue(request.credentialRef);
      const secret = getSecretMaterial(credentialRef);
      if (!secret) throw new Error('Provider credential reference is unavailable. Run Provider Loader in the same active n8n process and batch.');
      const variables = secretVariables(secret);
      const secrets = secretValues(secret);
      activeSecrets = secrets;
      const headers: Record<string, string> = {};
      if (isRecord(request.headers)) for (const [key, value] of Object.entries(request.headers)) if (value != null) headers[key] = interpolate(toStringValue(value), variables);
      if (secret.headerName && secret.headerValue) headers[secret.headerName] = interpolate(secret.headerValue, variables);
      else if (secret.authType === 'bearer' || secret.authType === 'oauth2') headers.Authorization = `Bearer ${secret.apiKey}`;
      else if (secret.authType === 'basic') headers.Authorization = `Basic ${variables.BASE64_KEY_SECRET}`;
      else if (secret.authType === 'token') headers.Authorization = `token ${secret.apiKey}:${secret.apiSecret}`;
      else if (secret.authType === 'session') headers[secret.headerName || 'Cookie'] = secret.headerValue ? interpolate(secret.headerValue, variables) : `session_id=${secret.extraValue}`;
      if (isRecord(request.idempotency)) {
        const header = toStringValue(request.idempotency.header);
        if (header) headers[header] = toStringValue(request.idempotency.value);
      }
      const query: Record<string, string> = {};
      if (isRecord(request.query)) for (const [key, value] of Object.entries(request.query)) if (value != null) query[key] = interpolate(toStringValue(value), variables);
      const contentType = toStringValue(request.contentType, 'application/json').toLowerCase();
      const bodyValue = interpolateJson((request.body ?? null) as JsonValue, variables);
      const body = contentType.includes('application/x-www-form-urlencoded') ? new URLSearchParams(formPairs(bodyValue)).toString() : bodyValue;
      const options: IHttpRequestOptions = {
        method: toStringValue(request.method, 'POST').toUpperCase() as IHttpRequestOptions['method'],
        url: interpolate(toStringValue(request.url), variables), headers, qs: Object.keys(query).length ? query : undefined,
        body, json: !contentType.includes('application/x-www-form-urlencoded'), timeout: Math.max(1, toFiniteNumber(request.timeoutMs, 60_000)),
        returnFullResponse: true, ignoreHttpStatusErrors: true,
      };
      if (dryRun) {
        output.push({ json: { ...item.json, rawExecution: {
          schemaVersion: '1.0', success: true, transportStatus: 'DRY_RUN', requestId: request.requestId,
          providerId: request.providerId, profileId: request.profileId, accountId: request.accountId, workerId: request.workerId,
          httpStatus: 0, responseHeaders: {}, responseBody: null, latencyMs: 0, responseSizeBytes: 0,
          requestPreview: { method: options.method, url: redactString(options.url, secrets), headerNames: Object.keys(headers), queryNames: Object.keys(query), contentType },
          startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), runtime: request.runtime,
        } }, pairedItem: { item: itemIndex } });
        continue;
      }
      const response = await this.helpers.httpRequest(options);
      const parts = responseParts(response);
      const finishedAt = new Date();
      const safeBody = includeResponseBody ? redactJson(parts.body, secrets) : null;
      output.push({ json: { ...item.json, rawExecution: {
        schemaVersion: '1.0', success: parts.statusCode >= 200 && parts.statusCode < 300, transportStatus: 'COMPLETED',
        requestId: request.requestId, transactionId: request.transactionId, providerId: request.providerId, profileId: request.profileId,
        accountId: request.accountId, workerId: request.workerId, actionId: request.actionId, httpStatus: parts.statusCode,
        responseHeaders: redactJson(parts.headers, secrets), responseBody: safeBody, latencyMs: Date.now() - started,
        responseSizeBytes: byteSize(parts.body), startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
        responsePaths: request.responsePaths, runtime: request.runtime,
      } }, pairedItem: { item: itemIndex } });
    } catch (error) {
      const message = redactString(error instanceof Error ? error.message : String(error), activeSecrets);
      if (stopOnTransportError && !this.continueOnFail()) throw new Error(`${this.getNode().name} item ${itemIndex}: ${message}`);
      const request = isRecord(item.json.readyRequest) ? item.json.readyRequest : {};
      output.push({ json: { ...item.json, rawExecution: {
        schemaVersion: '1.0', success: false, transportStatus: /timeout/i.test(message) ? 'TIMEOUT' : 'ERROR',
        requestId: request.requestId, providerId: request.providerId, profileId: request.profileId, accountId: request.accountId,
        workerId: request.workerId, actionId: request.actionId, httpStatus: 0, responseHeaders: {}, responseBody: null,
        latencyMs: Date.now() - started, responseSizeBytes: 0, error: { message }, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
        responsePaths: request.responsePaths, runtime: request.runtime,
      } }, pairedItem: { item: itemIndex } });
    }
  }
  return [output];
}
