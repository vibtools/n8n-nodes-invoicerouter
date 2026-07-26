import type {
  ICredentialDataDecryptedObject,
  IDataObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  JsonValue,
} from '../types/N8n';
import { isRecord, toStringValue } from '../utils/Helpers';
import { interpolateObject, interpolateString, parseObject } from '../utils/JsonPath';

export interface InvoiceApiCredential {
  baseUrl: string;
  authType: 'none' | 'bearer' | 'header' | 'basic' | 'query';
  bearerToken: string;
  apiKeyHeader: string;
  apiKey: string;
  queryKeyName: string;
  username: string;
  password: string;
  defaultHeaders: IDataObject;
  timeoutMs: number;
  allowHttp: boolean;
}

export interface PreparedApiRequest {
  method: IHttpRequestOptions['method'];
  endpoint: string;
  body?: JsonValue;
  extraHeaders?: IDataObject;
  query?: IDataObject;
  variables?: Record<string, string>;
}

function credentialString(credentials: ICredentialDataDecryptedObject, key: string): string {
  const value = credentials[key];
  return value == null ? '' : String(value);
}

export function normalizeCredential(credentials: ICredentialDataDecryptedObject): InvoiceApiCredential {
  const baseUrl = credentialString(credentials, 'baseUrl').replace(/\/+$/, '');
  if (!baseUrl) throw new Error('InvoiceRouter API credential Base URL is required.');

  const allowHttp = credentials.allowHttp === true;
  const parsed = new URL(baseUrl);
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(allowHttp || isLocalhost)) {
    throw new Error('Base URL must use HTTPS. Enable Allow HTTP only for a trusted private development service.');
  }

  const authTypeValue = credentialString(credentials, 'authType') || 'bearer';
  const authTypes = new Set(['none', 'bearer', 'header', 'basic', 'query']);
  if (!authTypes.has(authTypeValue)) throw new Error(`Unsupported authentication type: ${authTypeValue}`);

  return {
    baseUrl,
    authType: authTypeValue as InvoiceApiCredential['authType'],
    bearerToken: credentialString(credentials, 'bearerToken'),
    apiKeyHeader: credentialString(credentials, 'apiKeyHeader') || 'X-API-Key',
    apiKey: credentialString(credentials, 'apiKey'),
    queryKeyName: credentialString(credentials, 'queryKeyName') || 'api_key',
    username: credentialString(credentials, 'username'),
    password: credentialString(credentials, 'password'),
    defaultHeaders: parseObject(credentials.defaultHeaders, 'Default Headers'),
    timeoutMs: Number(credentials.timeoutMs) > 0 ? Number(credentials.timeoutMs) : 30000,
    allowHttp,
  };
}

export function joinUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
}

function stringRecord(value: IDataObject): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) continue;
    output[key] = typeof entry === 'string' ? entry : JSON.stringify(entry);
  }
  return output;
}

export function buildHttpOptions(
  credential: InvoiceApiCredential,
  request: PreparedApiRequest,
): IHttpRequestOptions {
  const variables = request.variables ?? {};
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...stringRecord(credential.defaultHeaders),
    ...stringRecord(request.extraHeaders ?? {}),
  };
  const qs = stringRecord(request.query ?? {});

  if (credential.authType === 'bearer') {
    if (!credential.bearerToken) throw new Error('Bearer Token is missing in the selected credential.');
    headers.Authorization = `Bearer ${credential.bearerToken}`;
  } else if (credential.authType === 'header') {
    if (!credential.apiKey) throw new Error('API Key is missing in the selected credential.');
    headers[credential.apiKeyHeader] = credential.apiKey;
  } else if (credential.authType === 'basic') {
    if (!credential.username) throw new Error('Username is missing in the selected credential.');
    headers.Authorization = `Basic ${globalThis.btoa(`${credential.username}:${credential.password}`)}`;
  } else if (credential.authType === 'query') {
    if (!credential.apiKey) throw new Error('API Key is missing in the selected credential.');
    qs[credential.queryKeyName] = credential.apiKey;
  }

  const body = request.body === undefined ? undefined : interpolateObject(request.body, variables);

  return {
    method: request.method,
    url: joinUrl(credential.baseUrl, interpolateString(request.endpoint, variables)),
    headers,
    qs: Object.keys(qs).length > 0 ? qs : undefined,
    body,
    json: true,
    timeout: credential.timeoutMs,
    returnFullResponse: false,
    ignoreHttpStatusErrors: false,
  };
}

export async function executeApiRequest(
  context: IExecuteFunctions,
  credential: InvoiceApiCredential,
  request: PreparedApiRequest,
): Promise<unknown> {
  return context.helpers.httpRequest(buildHttpOptions(credential, request));
}

export function safeResponseObject(response: unknown): IDataObject {
  if (isRecord(response)) return response;
  if (Array.isArray(response)) return { data: response as JsonValue[] };
  return { data: response == null ? null : toStringValue(response as JsonValue) };
}
