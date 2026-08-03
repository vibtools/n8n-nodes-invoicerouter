import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { maskSecret } from '../../shared/security/Redaction';
import { executionIdentity, registerProviderProfiles, type SecretMaterial } from '../../shared/runtime/RuntimeStore';
import { isRecord, normalizedKey, nowIso, parseJsonObject, slug, toBoolean, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';
import { lifecycleMetadata, normalizeProviderId } from '../../providers';

const COLUMN_ALIASES: Record<string, string[]> = {
  enabled: ['enabled', 'active'], provider: ['provider', 'providername'], account: ['account', 'accountname'],
  environment: ['environment', 'env'], action: ['action', 'operation'], method: ['method', 'httpmethod'],
  baseUrl: ['baseurl', 'apiurl'], endpoint: ['endpoint', 'path'], authType: ['authtype', 'authentication'],
  apiVersion: ['apiversion', 'version'], contentType: ['contenttype'], headerName: ['headername'],
  headerValue: ['headervalue'], apiKey: ['apikey', 'accesstoken'], apiSecret: ['apisecret', 'secret'],
  username: ['username', 'user', 'login', 'odoologin'], password: ['password', 'apikeysecret', 'odooapikey'],
  database: ['database', 'dbname', 'odoodatabase'], extraConfigJson: ['extraconfigjson', 'configjson', 'providerconfigjson'],
  extraValue: ['extravalue', 'tenantid', 'realmid', 'organizationid'], timeout: ['timeout'], notes: ['notes'],
  status: ['status', 'accountstatus'], statusReason: ['statusreason', 'reason'], autoDisabled: ['autodisabled'],
  consecutiveFailures: ['consecutivefailures'], retryCount: ['retrycount'], cooldownUntil: ['cooldownuntil'],
  lastErrorType: ['lasterrortype'], lastError: ['lasterror'], failoverGroup: ['failovergroup'],
  totalAllocated: ['totalallocated'], totalSent: ['totalsent'], totalFailed: ['totalfailed'],
};

function normalizedRow(row: IDataObject): Record<string, unknown> {
  const indexed = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) indexed.set(normalizedKey(key), value);
  const output: Record<string, unknown> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (indexed.has(alias)) { output[field] = indexed.get(alias); break; }
    }
  }
  return output;
}

function normalizeAuth(value: unknown): string {
  const auth = toStringValue(value).trim().toLowerCase().replace(/[\s/_-]+/g, '');
  if (auth.includes('oauth')) return 'oauth2';
  if (auth.includes('bearer')) return 'bearer';
  if (auth.includes('basic')) return 'basic';
  if (auth.includes('token')) return 'token';
  if (auth.includes('session')) return 'session';
  if (auth.includes('odoo') || auth.includes('jsonrpc')) return 'odoo-json-rpc';
  if (auth.includes('none')) return 'none';
  return auth || 'custom';
}

function maskHeader(value: string): string {
  return value
    .replace(/\{\{API_KEY\}\}|\{\{ACCESS_TOKEN\}\}/g, '[REDACTED]')
    .replace(/\{\{API_SECRET\}\}|\{\{BASE64_KEY_SECRET\}\}|\{\{SESSION_ID\}\}/g, '[REDACTED]');
}


function odooRpcError(response: IDataObject): string {
  const error = isRecord(response.error) ? response.error : {};
  const data = isRecord(error.data) ? error.data : {};
  return toStringValue(data.message ?? error.message ?? response.message, 'Unknown Odoo JSON-RPC error.');
}

async function odooRpc(context: IExecuteFunctions, input: {
  url: string; timeoutMs: number; service: string; method: string; args: unknown[]; id: string;
}): Promise<unknown> {
  const response = await context.helpers.httpRequest({
    method: 'POST', url: input.url, headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: { jsonrpc: '2.0', method: 'call', params: { service: input.service, method: input.method, args: input.args }, id: input.id },
    json: true, timeout: input.timeoutMs,
  });
  if (!isRecord(response)) throw new Error('Odoo preflight returned a non-object JSON-RPC response.');
  if (response.error !== undefined) throw new Error(odooRpcError(response));
  return response.result;
}

function classifyPreflightFailure(message: string): IDataObject {
  const text = message.toLowerCase();
  if (/database .*does not exist|unknown database|database not found/.test(text)) {
    return { status: 'DATABASE_INVALID', enabled: false, autoDisabled: true, errorType: 'CONFIGURATION_ERROR' };
  }
  if (/authentication|unauthorized|invalid login|invalid password|access denied/.test(text)) {
    return { status: 'AUTH_FAILED', enabled: false, autoDisabled: true, errorType: 'AUTHENTICATION_ERROR' };
  }
  if (/forbidden|permission|not allowed|access rights|authorization/.test(text)) {
    return { status: 'AUTHORIZATION_FAILED', enabled: false, autoDisabled: true, errorType: 'AUTHORIZATION_ERROR' };
  }
  if (/currency/.test(text)) {
    return { status: 'CURRENCY_INCOMPATIBLE', enabled: true, autoDisabled: false, errorType: 'CONFIGURATION_ERROR' };
  }
  return { status: 'CONFIGURATION_ERROR', enabled: true, autoDisabled: false, errorType: 'CONFIGURATION_ERROR' };
}

async function runOdooPreflight(context: IExecuteFunctions, input: {
  url: string; timeoutMs: number; database: string; username: string; password: string; currency: string; checkPermissions: boolean; rowNumber: number;
}): Promise<IDataObject> {
  try {
    const uidRaw = await odooRpc(context, {
      url: input.url, timeoutMs: input.timeoutMs, service: 'common', method: 'authenticate',
      args: [input.database, input.username, input.password, {}], id: `preflight-auth-${input.rowNumber}`,
    });
    const uid = toFiniteNumber(uidRaw, 0);
    if (!(uid > 0)) throw new Error('Odoo authentication failed for the configured username/password or API key.');

    const currency = input.currency.trim().toUpperCase();
    if (currency) {
      const count = toFiniteNumber(await odooRpc(context, {
        url: input.url, timeoutMs: input.timeoutMs, service: 'object', method: 'execute_kw',
        args: [input.database, uid, input.password, 'res.currency', 'search_count', [[['name', '=', currency], ['active', '=', true]]]],
        id: `preflight-currency-${input.rowNumber}`,
      }), 0);
      if (count < 1) throw new Error(`Odoo currency ${currency} was not found or is not active.`);
    }

    if (input.checkPermissions) {
      const checks: Array<[string, string]> = [
        ['res.partner', 'read'], ['res.partner', 'create'], ['account.move', 'read'], ['account.move', 'create'],
        ['account.move', 'write'], ['account.move.send.wizard', 'create'],
      ];
      for (const [model, operation] of checks) {
        const allowed = await odooRpc(context, {
          url: input.url, timeoutMs: input.timeoutMs, service: 'object', method: 'execute_kw',
          args: [input.database, uid, input.password, model, 'check_access_rights', [operation], { raise_exception: false }],
          id: `preflight-access-${model}-${operation}-${input.rowNumber}`,
        });
        if (allowed !== true) throw new Error(`Odoo access rights do not allow ${operation} on ${model}.`);
      }
    }
    return { passed: true, status: 'READY', enabled: true, autoDisabled: false, reason: '', uid };
  } catch (error) {
    const message = error instanceof Error ? error.message : toStringValue(error);
    return { passed: false, reason: message, ...classifyPreflightFailure(message) };
  }
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const batchId = toStringValue(this.getNodeParameter('batchId', 0, 'default'), 'default');
  const sourceName = toStringValue(this.getNodeParameter('sourceName', 0, 'provider'), 'provider');
  const duplicatePolicy = toStringValue(this.getNodeParameter('duplicatePolicy', 0, 'error'), 'error');
  const includeDisabled = Boolean(this.getNodeParameter('includeDisabled', 0, false));
  const strictValidation = Boolean(this.getNodeParameter('strictValidation', 0, true));
  const enableOdooPreflight = Boolean(this.getNodeParameter('enableOdooPreflight', 0, false));
  const preflightCurrency = toStringValue(this.getNodeParameter('preflightCurrency', 0, 'USD'), 'USD').trim().toUpperCase();
  const preflightCheckPermissions = Boolean(this.getNodeParameter('preflightCheckPermissions', 0, true));
  const preflightFailurePolicy = toStringValue(this.getNodeParameter('preflightFailurePolicy', 0, 'excludeAndReport'), 'excludeAndReport');
  const identity = executionIdentity(this, batchId);
  const warnings: string[] = [];
  const byId = new Map<string, IDataObject>();
  const secrets = new Map<string, SecretMaterial>();
  const preflightResults: IDataObject[] = [];

  for (const [itemIndex, item] of items.entries()) {
    const row = normalizedRow(item.json);
    const requestedEnabled = toBoolean(row.enabled, true);
    const managedStatus = toStringValue(row.status).trim().toUpperCase();
    const autoDisabled = toBoolean(row.autoDisabled, false);
    const hardDisabled = autoDisabled || ['DISABLED_AUTO', 'AUTH_FAILED', 'AUTHORIZATION_FAILED', 'DATABASE_INVALID', 'QUOTA_EXHAUSTED'].includes(managedStatus);
    const resetRequested = managedStatus === 'RESET';
    const enabled = requestedEnabled && (!hardDisabled || resetRequested);
    if (!enabled && !includeDisabled) continue;
    const providerName = toStringValue(row.provider).trim();
    const accountName = toStringValue(row.account).trim();
    const environment = slug(row.environment) || 'live';
    const actionName = toStringValue(row.action).trim();
    const method = toStringValue(row.method).trim().toUpperCase();
    const baseUrl = toStringValue(row.baseUrl).trim().replace(/\/+$/, '');
    const endpoint = toStringValue(row.endpoint).trim();
    const authType = normalizeAuth(row.authType);
    const timeoutSeconds = toFiniteNumber(row.timeout, 60);
    const errors: string[] = [];
    if (!providerName) errors.push('Provider is required');
    if (!accountName) errors.push('Account is required');
    if (!actionName) errors.push('Action is required');
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) errors.push('Method must be GET, POST, PUT, PATCH, or DELETE');
    if (!baseUrl) errors.push('Base URL is required');
    if (!endpoint) errors.push('Endpoint is required');
    if (!(timeoutSeconds > 0)) errors.push('Timeout must be a positive number');
    const apiKey = toStringValue(row.apiKey);
    const apiSecret = toStringValue(row.apiSecret);
    const username = toStringValue(row.username);
    const password = toStringValue(row.password || row.apiSecret);
    const database = toStringValue(row.database);
    const extraValue = toStringValue(row.extraValue);
    const headerName = toStringValue(row.headerName);
    const headerValue = toStringValue(row.headerValue);
    let extraConfig: IDataObject = {};
    if (toStringValue(row.extraConfigJson).trim()) extraConfig = parseJsonObject(row.extraConfigJson, `Row ${itemIndex + 2} Extra Config`);
    if (['bearer', 'oauth2'].includes(authType) && !apiKey && !headerValue) errors.push('API Key or Header Value is required for bearer/oauth2 auth');
    if (authType === 'basic' && (!apiKey || !apiSecret)) errors.push('API Key and API Secret are required for basic auth');
    if (authType === 'token' && (!apiKey || !apiSecret)) errors.push('API Key and API Secret are required for token auth');
    if (authType === 'session' && !extraValue && !headerValue) errors.push('Extra Value or Header Value is required for session auth');
    if (providerName && normalizeProviderId(providerName) === 'odoo') {
      if (!database) errors.push('Database is required for Odoo provider rows');
      if (!username && !apiKey) errors.push('Username or API Key is required for Odoo provider rows');
      if (!password && !apiSecret) errors.push('Password or API Secret is required for Odoo provider rows');
    }
    if (headerValue && !headerName && !['bearer', 'oauth2', 'basic', 'token', 'session'].includes(authType)) errors.push('Header Name is required when Header Value is set for custom auth');
    if (errors.length) {
      const message = `Row ${itemIndex + 2}: ${errors.join('; ')}`;
      if (strictValidation && enabled) throw new Error(message);
      warnings.push(message);
      continue;
    }

    let parsedUrl: URL;
    try { parsedUrl = new URL(baseUrl); } catch { throw new Error(`Row ${itemIndex + 2}: Base URL is invalid.`); }
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) throw new Error(`Row ${itemIndex + 2}: Base URL must use HTTP or HTTPS.`);

    const providerId = normalizeProviderId(providerName);
    const accountId = slug(accountName);
    const actionId = slug(actionName);
    const id = `${providerId}-${accountId}-${environment}-${actionId}`;
    const profile: IDataObject = {
      id, enabled, providerId, providerName, accountId, accountName, environment, actionId, actionName,
      method, baseUrl, endpoint, url: `${baseUrl}/${endpoint.replace(/^\/+/, '')}`,
      authType, apiVersion: toStringValue(row.apiVersion), contentType: toStringValue(row.contentType, 'application/json'),
      timeoutMs: Math.round(timeoutSeconds * 1000),
      headerName, headerPreview: headerValue ? maskHeader(headerValue) : '',
      apiKeyPreview: maskSecret(apiKey || username), apiSecretPreview: maskSecret(apiSecret || password), extraValuePreview: maskSecret(extraValue || database),
      connection: { usernamePreview: maskSecret(username || apiKey), database: database ? maskSecret(database) : '', extraConfig },
      notes: toStringValue(row.notes), priority: itemIndex, weight: 1, failoverGroup: slug(row.failoverGroup),
      managedStatus: resetRequested ? 'READY' : managedStatus || (enabled ? 'READY' : 'DISABLED_USER'),
      managedStatusReason: toStringValue(row.statusReason), autoDisabled: hardDisabled && !resetRequested,
      consecutiveFailures: Math.max(0, toFiniteNumber(row.consecutiveFailures, 0)), retryCount: Math.max(0, toFiniteNumber(row.retryCount, 0)),
      cooldownUntil: toStringValue(row.cooldownUntil), lastErrorType: toStringValue(row.lastErrorType), lastError: toStringValue(row.lastError),
      totalAllocated: Math.max(0, toFiniteNumber(row.totalAllocated, 0)), totalSent: Math.max(0, toFiniteNumber(row.totalSent, 0)), totalFailed: Math.max(0, toFiniteNumber(row.totalFailed, 0)),
      metadata: { sourceType: 'google_sheet', sheetName: sourceName, sheetRow: itemIndex + 2 },
      lifecycle: lifecycleMetadata(providerId, extraConfig),
    };
    const secret: SecretMaterial = { apiKey, apiSecret, extraValue, headerName, headerValue, authType, username, password, database, extraConfig };
    if (enableOdooPreflight && enabled && providerId === 'odoo') {
      const preflight = await runOdooPreflight(this, {
        url: `${baseUrl}/${endpoint.replace(/^\/+/, '')}`, timeoutMs: Math.round(timeoutSeconds * 1000), database,
        username: username || apiKey, password: password || apiSecret, currency: preflightCurrency,
        checkPermissions: preflightCheckPermissions, rowNumber: itemIndex + 2,
      });
      const result: IDataObject = {
        Account: accountName, Account_ID: accountId, Profile_ID: id, Enabled: preflight.enabled,
        status: preflight.status, Status_Reason: preflight.reason, Auto_Disabled: preflight.autoDisabled,
        Last_Error_Type: preflight.passed === true ? '' : preflight.errorType, Last_Error: preflight.reason,
        Updated_At: nowIso(), passed: preflight.passed,
      };
      preflightResults.push(result);
      if (preflight.passed !== true) {
        const message = `Row ${itemIndex + 2} Odoo preflight failed: ${toStringValue(preflight.reason)}`;
        warnings.push(message);
        if (preflightFailurePolicy === 'error') throw new Error(message);
        continue;
      }
    }
    if (byId.has(id)) {
      const message = `Duplicate provider action profile: ${id}`;
      if (duplicatePolicy === 'error') throw new Error(message);
      warnings.push(message);
      if (duplicatePolicy === 'first') continue;
    }
    byId.set(id, profile);
    secrets.set(id, secret);
  }

  const providers = [...byId.values()];
  registerProviderProfiles(identity.scopeKey, providers, secrets);
  return [[{
    json: {
      success: true, total: providers.length, generated_at: nowIso(), batch_id: batchId,
      source: { type: 'google_sheet', sheet_name: sourceName }, providers, warnings, preflightResults,
      runtime: { scopeKey: identity.scopeKey, workflowId: identity.workflowId, executionId: identity.executionId },
    },
  }]];
}
