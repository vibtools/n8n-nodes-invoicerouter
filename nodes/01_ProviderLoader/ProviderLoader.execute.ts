import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { maskSecret } from '../../shared/security/Redaction';
import { executionIdentity, registerProviderProfiles, type SecretMaterial } from '../../shared/runtime/RuntimeStore';
import { cloneJson, isRecord, normalizedKey, nowIso, parseJsonObject, slug, toBoolean, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';
import { lifecycleMetadata, normalizeProviderId } from '../../providers';
import { requireOdooCapabilityProfile } from '../../shared/odoo/OdooCapabilityManifest';

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
  issuerKey: ['issuerkey', 'legalissuerkey'], companyId: ['companyid', 'odoocompanyid'],
  companyName: ['companyname', 'odoocompanyname'],
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
  if (/unsupported odoo server version/.test(text)) {
    return { status: 'ODOO_VERSION_UNSUPPORTED', enabled: true, autoDisabled: false, errorType: 'CONFIGURATION_ERROR' };
  }
  if (/currency/.test(text)) {
    return { status: 'CURRENCY_INCOMPATIBLE', enabled: true, autoDisabled: false, errorType: 'CONFIGURATION_ERROR' };
  }
  return { status: 'CONFIGURATION_ERROR', enabled: true, autoDisabled: false, errorType: 'CONFIGURATION_ERROR' };
}

async function runOdooPreflight(context: IExecuteFunctions, input: {
  url: string;
  timeoutMs: number;
  database: string;
  username: string;
  password: string;
  currency: string;
  checkPermissions: boolean;
  rowNumber: number;
}): Promise<IDataObject> {
  try {
    const versionRaw = await odooRpc(context, {
      url: input.url,
      timeoutMs: input.timeoutMs,
      service: 'common',
      method: 'version',
      args: [],
      id: `preflight-version-${input.rowNumber}`,
    });
    const version = isRecord(versionRaw) ? versionRaw : {};
    const serverVersion = toStringValue(version.server_version ?? version.serverVersion ?? version.server_serie);
    const capabilityProfile = requireOdooCapabilityProfile(serverVersion);

    const uidRaw = await odooRpc(context, {
      url: input.url,
      timeoutMs: input.timeoutMs,
      service: 'common',
      method: 'authenticate',
      args: [input.database, input.username, input.password, {}],
      id: `preflight-auth-${input.rowNumber}`,
    });
    const uid = toFiniteNumber(uidRaw, 0);
    if (!(uid > 0)) throw new Error('Odoo authentication failed for the configured username/password or API key.');

    const requestedCurrency = input.currency.trim().toUpperCase();
    const currencyDomain = requestedCurrency ? [[['name', '=', requestedCurrency], ['active', '=', true]]] : [[['active', '=', true]]];
    const currencyRows = await odooRpc(context, {
      url: input.url,
      timeoutMs: input.timeoutMs,
      service: 'object',
      method: 'execute_kw',
      args: [
        input.database,
        uid,
        input.password,
        'res.currency',
        'search_read',
        currencyDomain,
        { fields: capabilityProfile.senderFields.currencySearch, limit: 300 },
      ],
      id: `preflight-currencies-${input.rowNumber}`,
    });
    const activeCurrencies = Array.isArray(currencyRows)
      ? currencyRows.filter(isRecord).map((row) => toStringValue(row.name).trim().toUpperCase()).filter(Boolean)
      : [];
    if (requestedCurrency && !activeCurrencies.includes(requestedCurrency)) {
      throw new Error(`Odoo currency ${requestedCurrency} was not found or is not active.`);
    }

    const modelCapabilities: IDataObject = {};
    if (input.checkPermissions) {
      for (const [model, fields] of Object.entries(capabilityProfile.requiredFields)) {
        const fieldInfo = await odooRpc(context, {
          url: input.url,
          timeoutMs: input.timeoutMs,
          service: 'object',
          method: 'execute_kw',
          args: [
            input.database,
            uid,
            input.password,
            model,
            'fields_get',
            [fields],
            { attributes: ['type', 'required', 'readonly'] },
          ],
          id: `preflight-fields-${model}-${input.rowNumber}`,
        });
        if (!isRecord(fieldInfo)) throw new Error(`Odoo model ${model} did not return field metadata.`);
        const missing = fields.filter((field) => !Object.prototype.hasOwnProperty.call(fieldInfo, field));
        if (missing.length > 0) throw new Error(`Odoo model ${model} is missing required fields: ${missing.join(', ')}.`);
        modelCapabilities[model] = { fields: Object.keys(fieldInfo), readable: true };
      }
      for (const model of capabilityProfile.readProbeModels) {
        await odooRpc(context, {
          url: input.url,
          timeoutMs: input.timeoutMs,
          service: 'object',
          method: 'execute_kw',
          args: [input.database, uid, input.password, model, 'search_count', [[]]],
          id: `preflight-read-${model}-${input.rowNumber}`,
        });
      }
    }

    const userRows = await odooRpc(context, {
      url: input.url,
      timeoutMs: input.timeoutMs,
      service: 'object',
      method: 'execute_kw',
      args: [
        input.database,
        uid,
        input.password,
        'res.users',
        'read',
        [[uid], capabilityProfile.senderFields.userCompanyRead],
      ],
      id: `preflight-user-company-${input.rowNumber}`,
    });
    const user = Array.isArray(userRows) ? userRows.filter(isRecord)[0] ?? {} : {};
    const companyRelation = user.company_id;
    const companyId = Array.isArray(companyRelation) ? toFiniteNumber(companyRelation[0], 0) : toFiniteNumber(companyRelation, 0);
    if (companyId <= 0) throw new Error('Odoo authenticated user did not expose a current company identity.');
    const companyRows = await odooRpc(context, {
      url: input.url,
      timeoutMs: input.timeoutMs,
      service: 'object',
      method: 'execute_kw',
      args: [
        input.database,
        uid,
        input.password,
        'res.company',
        'read',
        [[companyId], capabilityProfile.senderFields.companyRead],
      ],
      id: `preflight-company-${input.rowNumber}`,
    });
    const company = Array.isArray(companyRows) ? companyRows.filter(isRecord)[0] ?? {} : {};
    const companyName = toStringValue(company.name).trim();
    if (!companyName) throw new Error(`Odoo company ${companyId} did not expose a company name.`);

    return {
      passed: true,
      status: 'READY',
      enabled: true,
      autoDisabled: false,
      reason: 'Capability validated; create/post/send side-effect permission remains unproven until a live canary succeeds.',
      uid,
      capabilities: {
        serverVersion,
        majorVersion: capabilityProfile.majorVersion,
        profileId: capabilityProfile.id,
        supported: true,
        capabilityStatus: 'CAPABILITY_VALIDATED_SIDE_EFFECT_PERMISSION_UNPROVEN',
        sideEffectPermissionsProven: false,
        activeCurrencies,
        models: modelCapabilities,
        requiredMethods: capabilityProfile.requiredMethods,
        versionSpecificWizardFields: capabilityProfile.versionSpecificWizardFields,
        company: {
          id: companyId,
          name: companyName,
          currencyId: Array.isArray(company.currency_id) ? toFiniteNumber(company.currency_id[0], 0) : toFiniteNumber(company.currency_id, 0),
        },
        checkedAt: nowIso(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : toStringValue(error);
    return { passed: false, reason: message, ...classifyPreflightFailure(message) };
  }
}

function configuredIssuerKey(value: unknown): string {
  const text = toStringValue(value).trim();
  if (!text || /^(replace|your|todo|change[-_ ]?me)/i.test(text)) return '';
  return text;
}

function normalizedIssuerValue(value: unknown): string {
  return toStringValue(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function capabilityCompany(profile: IDataObject): IDataObject {
  const capabilities = isRecord(profile.preflightCapabilities) ? profile.preflightCapabilities : {};
  return isRecord(capabilities.company) ? capabilities.company : {};
}

function hasLegacyIssuerBlock(profile: IDataObject): boolean {
  const evidence = [profile.managedStatus, profile.managedStatusReason, profile.lastErrorType, profile.lastError]
    .map((value) => toStringValue(value).trim().toUpperCase())
    .filter(Boolean)
    .join(' ');
  return evidence.includes('ISSUER_MISMATCH') || evidence.includes('ISSUER COMPATIBILITY BLOCKED');
}

function validateOdooIssuerGroups(
  profilesById: Map<string, IDataObject>,
  preflightResults: IDataObject[],
  warnings: string[],
): void {
  const groups = new Map<string, IDataObject[]>();
  for (const profile of profilesById.values()) {
    if (toStringValue(profile.providerId) !== 'odoo') continue;
    const failoverGroup = toStringValue(profile.failoverGroup).trim();
    if (!failoverGroup) {
      const legacyIssuerBlock = hasLegacyIssuerBlock(profile);
      profile.issuerCompatibility = { status: 'NOT_APPLICABLE', compatible: true, blocking: false, checkedAt: nowIso() };
      if (legacyIssuerBlock) {
        profile.managedStatus = 'READY';
        profile.managedStatusReason = '';
        profile.lastErrorType = '';
        profile.lastError = '';
        profile.autoDisabled = false;
      }
      const result = preflightResults.find((entry) => toStringValue(entry.Profile_ID) === toStringValue(profile.id));
      if (result) {
        result.Issuer_Compatibility = 'NOT_APPLICABLE';
        result.passed = true;
        if (legacyIssuerBlock) {
          result.Last_Error_Type = '';
          result.Last_Error = '';
        }
      }
      continue;
    }
    const entries = groups.get(failoverGroup) ?? [];
    entries.push(profile);
    groups.set(failoverGroup, entries);
  }

  for (const [failoverGroup, profiles] of groups.entries()) {
    const issues: string[] = [];
    const issuerKeys = new Set<string>();
    const companyNames = new Set<string>();
    for (const profile of profiles) {
      const issuerKey = configuredIssuerKey(profile.issuerKey);
      const company = capabilityCompany(profile);
      const companyId = toFiniteNumber(company.id, 0);
      const companyName = toStringValue(company.name).trim();
      const expectedCompanyId = toFiniteNumber(profile.expectedCompanyId, 0);
      const expectedCompanyName = toStringValue(profile.expectedCompanyName).trim();
      if (issuerKey) issuerKeys.add(normalizedIssuerValue(issuerKey));
      if (companyId <= 0 || !companyName) issues.push(`${toStringValue(profile.accountName)} has no verified Odoo company identity`);
      if (companyName) companyNames.add(normalizedIssuerValue(companyName));
      if (expectedCompanyId > 0 && companyId > 0 && expectedCompanyId !== companyId) {
        issues.push(`${toStringValue(profile.accountName)} expected Company_ID ${expectedCompanyId} but preflight returned ${companyId}`);
      }
      if (expectedCompanyName && companyName && normalizedIssuerValue(expectedCompanyName) !== normalizedIssuerValue(companyName)) {
        issues.push(`${toStringValue(profile.accountName)} expected Company_Name ${expectedCompanyName} but preflight returned ${companyName}`);
      }
    }
    if (issuerKeys.size > 1) issues.push(`Failover_Group ${failoverGroup} contains different non-empty Issuer_Key values`);
    if (companyNames.size > 1) issues.push(`Failover_Group ${failoverGroup} resolves to different Odoo company names`);

    const uniqueIssues = [...new Set(issues)];
    const diagnosticStatus = uniqueIssues.length === 0 ? 'VERIFIED' : 'WARNING';
    const sharedIssuerKey = profiles.map((profile) => configuredIssuerKey(profile.issuerKey)).find(Boolean) ?? '';
    for (const profile of profiles) {
      const company = capabilityCompany(profile);
      const profileId = toStringValue(profile.id);
      const result = preflightResults.find((entry) => toStringValue(entry.Profile_ID) === profileId);
      const legacyIssuerBlock = hasLegacyIssuerBlock(profile);
      profile.issuerCompatibility = {
        status: diagnosticStatus,
        compatible: true,
        blocking: false,
        failoverGroup,
        issuerKey: sharedIssuerKey,
        companyId: toFiniteNumber(company.id, 0),
        companyName: toStringValue(company.name),
        issues: uniqueIssues,
        checkedAt: nowIso(),
      };
      if (legacyIssuerBlock) {
        profile.managedStatus = 'READY';
        profile.managedStatusReason = '';
        profile.lastErrorType = '';
        profile.lastError = '';
        profile.autoDisabled = false;
      }
      if (result) {
        result.Issuer_Key = configuredIssuerKey(profile.issuerKey);
        result.Company_ID = toFiniteNumber(company.id, 0) || '';
        result.Company_Name = toStringValue(company.name);
        result.Issuer_Compatibility = diagnosticStatus;
        result.passed = true;
        if (legacyIssuerBlock) {
          result.Last_Error_Type = '';
          result.Last_Error = '';
        }
        if (uniqueIssues.length > 0) {
          const diagnostic = `Issuer diagnostic warning: ${uniqueIssues.join('; ')}.`;
          result.Status_Reason = [toStringValue(result.Status_Reason).trim(), diagnostic].filter(Boolean).join(' ');
        }
      }
    }
    if (uniqueIssues.length > 0) {
      warnings.push(`Odoo Failover_Group ${failoverGroup} issuer diagnostic warning: ${uniqueIssues.join('; ')}.`);
    }
  }
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const rehydration = items
    .map((item) => item.json.__invoiceRouterRehydration)
    .find((value): value is IDataObject => isRecord(value));
  const batchId = toStringValue(this.getNodeParameter('batchId', 0, 'default'), 'default');
  const sourceName = toStringValue(this.getNodeParameter('sourceName', 0, 'provider'), 'provider');
  const duplicatePolicy = toStringValue(this.getNodeParameter('duplicatePolicy', 0, 'error'), 'error');
  const includeDisabled = Boolean(this.getNodeParameter('includeDisabled', 0, false));
  const strictValidation = Boolean(this.getNodeParameter('strictValidation', 0, true));
  const enableOdooPreflight = Boolean(this.getNodeParameter('enableOdooPreflight', 0, false));
  const preflightCurrency = toStringValue(this.getNodeParameter('preflightCurrency', 0, ''), '').trim().toUpperCase();
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
      issuerKey: configuredIssuerKey(row.issuerKey), expectedCompanyId: toFiniteNumber(row.companyId, 0),
      expectedCompanyName: toStringValue(row.companyName).trim(),
      issuerCompatibility: { status: 'UNVERIFIED', compatible: false },
      managedStatus: resetRequested ? 'READY' : managedStatus || (enabled ? 'READY' : 'DISABLED_USER'),
      managedStatusReason: toStringValue(row.statusReason), autoDisabled: hardDisabled && !resetRequested,
      consecutiveFailures: Math.max(0, toFiniteNumber(row.consecutiveFailures, 0)), retryCount: Math.max(0, toFiniteNumber(row.retryCount, 0)),
      cooldownUntil: toStringValue(row.cooldownUntil), lastErrorType: toStringValue(row.lastErrorType), lastError: toStringValue(row.lastError),
      totalAllocated: Math.max(0, toFiniteNumber(row.totalAllocated, 0)), totalSent: Math.max(0, toFiniteNumber(row.totalSent, 0)), totalFailed: Math.max(0, toFiniteNumber(row.totalFailed, 0)),
      metadata: { sourceType: 'google_sheet', sheetName: sourceName, sheetRow: Math.max(2, Math.floor(toFiniteNumber(item.json.row_number, itemIndex + 2))) },
      lifecycle: lifecycleMetadata(providerId, extraConfig),
    };
    const secret: SecretMaterial = { apiKey, apiSecret, extraValue, headerName, headerValue, authType, username, password, database, extraConfig };
    if (enableOdooPreflight && enabled && providerId === 'odoo') {
      const preflight = await runOdooPreflight(this, {
        url: `${baseUrl}/${endpoint.replace(/^\/+/, '')}`, timeoutMs: Math.round(timeoutSeconds * 1000), database,
        username: username || apiKey, password: password || apiSecret, currency: preflightCurrency,
        checkPermissions: preflightCheckPermissions, rowNumber: itemIndex + 2,
      });
      const capabilities = isRecord(preflight.capabilities) ? preflight.capabilities : {};
      const company = isRecord(capabilities.company) ? capabilities.company : {};
      const sourceRow = Math.max(2, Math.floor(toFiniteNumber(item.json.row_number, itemIndex + 2)));
      const result: IDataObject = {
        Provider: providerName, Account: accountName, Account_Name: accountName, Account_ID: accountId, Profile_ID: id,
        row_number: sourceRow, Row_Number: sourceRow,
        Failover_Group: slug(row.failoverGroup), Enabled: preflight.enabled,
        status: preflight.status, Status_Reason: preflight.reason, Auto_Disabled: preflight.autoDisabled,
        Last_Error_Type: preflight.passed === true ? '' : preflight.errorType, Last_Error: preflight.reason,
        Issuer_Key: configuredIssuerKey(row.issuerKey), Company_ID: toFiniteNumber(company.id, 0) || '',
        Company_Name: toStringValue(company.name), Odoo_Server_Version: toStringValue(capabilities.serverVersion),
        Odoo_Major_Version: toFiniteNumber(capabilities.majorVersion, 0) || '',
        Capability_Status: toStringValue(capabilities.capabilityStatus), Issuer_Compatibility: 'PENDING',
        Updated_At: nowIso(), passed: preflight.passed,
      };
      preflightResults.push(result);
      if (preflight.passed !== true) {
        const message = `Row ${itemIndex + 2} Odoo preflight failed: ${toStringValue(preflight.reason)}`;
        warnings.push(message);
        if (preflightFailurePolicy === 'error') throw new Error(message);
        continue;
      }
      profile.preflightCapabilities = isRecord(preflight.capabilities) ? preflight.capabilities : {};
      const verifiedCompany = isRecord(profile.preflightCapabilities.company) ? profile.preflightCapabilities.company : {};
      profile.companyId = toFiniteNumber(verifiedCompany.id, 0);
      profile.companyName = toStringValue(verifiedCompany.name);
      profile.odooServerVersion = toStringValue(profile.preflightCapabilities.serverVersion);
      profile.odooMajorVersion = toFiniteNumber(profile.preflightCapabilities.majorVersion, 0);
      profile.odooCapabilityProfileId = toStringValue(profile.preflightCapabilities.profileId);
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

  validateOdooIssuerGroups(byId, preflightResults, warnings);
  const providers = [...byId.values()];
  registerProviderProfiles(identity.scopeKey, providers, secrets);
  return [[{
    json: {
      success: true, total: providers.length, generated_at: nowIso(), batch_id: batchId,
      source: { type: 'google_sheet', sheet_name: sourceName }, providers, warnings, preflightResults,
      runtime: { scopeKey: identity.scopeKey, workflowId: identity.workflowId, executionId: identity.executionId },
      rehydration: rehydration ? cloneJson(rehydration) : null,
    },
  }]];
}
