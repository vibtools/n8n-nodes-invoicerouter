import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { executionIdentity, reserveRecipient } from '../../shared/runtime/RuntimeStore';
import { isRecord, normalizedKey, nowIso, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KNOWN: Record<string, string[]> = {
  email: ['email', 'emailaddress', 'customeremail'], name: ['name', 'fullname', 'customername'], phone: ['phone', 'mobile', 'contact'],
  company: ['company', 'organization'], address: ['address', 'street'], country: ['country'], state: ['state', 'province'],
  city: ['city'], zip: ['zip', 'zipcode', 'postalcode'], status: ['status', 'sendstatus'], jobId: ['jobid'], campaignId: ['campaignid'],
  attemptCount: ['attemptcount'], lastAccount: ['lastaccount'], lastError: ['lasterror'], updatedAt: ['updatedat'],
};

function field(row: IDataObject, configured: string, aliases: string[]): unknown {
  if (Object.prototype.hasOwnProperty.call(row, configured)) return row[configured];
  const wanted = new Set([normalizedKey(configured), ...aliases]);
  for (const [key, value] of Object.entries(row)) if (wanted.has(normalizedKey(key))) return value;
  return undefined;
}

function generatedName(email: string, mode: string, fixedName: string): string {
  if (mode === 'customFixed') return fixedName;
  const username = email.split('@')[0] || 'customer';
  const formatted = username.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
  if (mode === 'formatted') return formatted || username;
  if (mode === 'firstWord') return (formatted.split(/\s+/)[0] || username);
  return username;
}

function stableHash(value: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`.toUpperCase().padStart(13, '0');
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const batchId = toStringValue(this.getNodeParameter('batchId', 0, 'default'), 'default');
  const emailField = toStringValue(this.getNodeParameter('emailField', 0, 'Email'), 'Email');
  const nameField = toStringValue(this.getNodeParameter('nameField', 0, 'Name'), 'Name');
  const addressField = toStringValue(this.getNodeParameter('addressField', 0, 'Address'), 'Address');
  const statusField = toStringValue(this.getNodeParameter('statusField', 0, 'status'), 'status');
  const jobIdField = toStringValue(this.getNodeParameter('jobIdField', 0, 'Job_ID'), 'Job_ID');
  const campaignIdField = toStringValue(this.getNodeParameter('campaignIdField', 0, 'Campaign_ID'), 'Campaign_ID');
  const defaultCampaignId = toStringValue(this.getNodeParameter('defaultCampaignId', 0, 'default-campaign'), 'default-campaign').trim();
  const nameGeneration = toStringValue(this.getNodeParameter('nameGeneration', 0, 'formatted'));
  const fixedCustomerName = toStringValue(this.getNodeParameter('fixedCustomerName', 0, '')).trim();
  const invalidPolicy = toStringValue(this.getNodeParameter('invalidPolicy', 0, 'skip'));
  const preserveCustom = Boolean(this.getNodeParameter('preserveCustomColumns', 0, true));
  const preventReuse = Boolean(this.getNodeParameter('preventReuse', 0, true));
  if (nameGeneration === 'customFixed' && !fixedCustomerName) throw new Error('Fixed Customer Name is required when Name Generation is Custom Fixed Name.');
  const identity = executionIdentity(this, batchId);
  const localSeen = new Set<string>();
  const output: INodeExecutionData[] = [];
  const skipped: IDataObject[] = [];

  items.forEach((item, itemIndex) => {
    const email = toStringValue(field(item.json, emailField, KNOWN.email)).trim().toLowerCase();
    let reason = '';
    if (!email) reason = 'empty email';
    else if (!EMAIL_PATTERN.test(email)) reason = 'invalid email format';
    else if (localSeen.has(email)) reason = 'duplicate email in input';
    else if (preventReuse && !reserveRecipient(identity.scopeKey, email)) reason = 'recipient already reserved in this batch';
    if (reason) {
      if (invalidPolicy === 'error') throw new Error(`Recipient row ${itemIndex + 1}: ${reason}.`);
      skipped.push({ row: itemIndex + 1, email, reason });
      return;
    }
    localSeen.add(email);
    const suppliedName = toStringValue(field(item.json, nameField, KNOWN.name)).trim();
    const campaignId = toStringValue(field(item.json, campaignIdField, KNOWN.campaignId), defaultCampaignId).trim() || defaultCampaignId;
    const existingJobId = toStringValue(field(item.json, jobIdField, KNOWN.jobId)).trim();
    const jobId = existingJobId || `JOB-${stableHash(`${campaignId}:${email}`)}`;
    const incomingStatus = toStringValue(field(item.json, statusField, KNOWN.status)).trim().toUpperCase();
    const terminalStatuses = new Set(['SENT', 'QUEUED', 'FAILED', 'MANUAL_REVIEW', 'DUPLICATE', 'BLOCKED']);
    if (terminalStatuses.has(incomingStatus)) {
      const terminalReason = `status ${incomingStatus} requires an explicit reset to PENDING before processing`;
      skipped.push({ row: itemIndex + 1, email, reason: terminalReason });
      return;
    }
    const attemptCount = Math.max(0, toFiniteNumber(field(item.json, 'Attempt_Count', KNOWN.attemptCount), 0));
    const recognizedKeys = new Set(Object.values(KNOWN).flat());
    const customFields: IDataObject = {};
    if (preserveCustom) {
      for (const [key, value] of Object.entries(item.json)) {
        if (!recognizedKeys.has(normalizedKey(key)) && value !== undefined) customFields[key] = value;
      }
    }
    const name = nameGeneration === 'customFixed' ? fixedCustomerName : suppliedName || generatedName(email, nameGeneration, fixedCustomerName);
    const recipient: IDataObject = {
      email, name,
      phone: toStringValue(field(item.json, 'Phone', KNOWN.phone)), company: toStringValue(field(item.json, 'Company', KNOWN.company)),
      address: toStringValue(field(item.json, addressField, KNOWN.address)), country: toStringValue(field(item.json, 'Country', KNOWN.country)),
      state: toStringValue(field(item.json, 'State', KNOWN.state)), city: toStringValue(field(item.json, 'City', KNOWN.city)),
      zip: toStringValue(field(item.json, 'ZIP Code', KNOWN.zip)), customFields,
    };
    const managedState = isRecord(item.json.invoiceRouterState) ? item.json.invoiceRouterState : {};
    const failoverState = isRecord(managedState.failoverState) ? managedState.failoverState : null;
    const lifecycleResume = isRecord(managedState.lifecycleResume) ? managedState.lifecycleResume : null;
    const accountReportSeed = isRecord(managedState.accountReportSeed) ? managedState.accountReportSeed : {};
    const retryCount = Math.max(0, toFiniteNumber(managedState.retryCount, 0));
    const job: IDataObject = {
      schemaVersion: '1.0', jobId, campaignId, status: incomingStatus || 'PENDING', attemptCount, accountReportSeed,
      lastAccountId: toStringValue(field(item.json, 'Last_Account', KNOWN.lastAccount)),
      lastError: toStringValue(field(item.json, 'Last_Error', KNOWN.lastError)),
      sourceRow: itemIndex + 2, updatedAt: toStringValue(field(item.json, 'Updated_At', KNOWN.updatedAt)),
    };
    output.push({
      json: { recipient, job, failoverState, lifecycleResume, retryCount, recipientMeta: { batchId, campaignId, jobId, sourceRow: itemIndex + 2, reserved: preventReuse, normalizedAt: nowIso(), skippedCount: skipped.length }, runtime: { scopeKey: identity.scopeKey } },
      pairedItem: { item: itemIndex },
    });
  });
  if (output.length === 0 && skipped.length > 0) {
    output.push({ json: { recipientListEmpty: true, skippedRecipients: skipped, runtime: { scopeKey: identity.scopeKey } } });
  } else if (output.length > 0 && skipped.length > 0) {
    output[0].json.skippedRecipients = skipped;
  }
  return [output];
}
