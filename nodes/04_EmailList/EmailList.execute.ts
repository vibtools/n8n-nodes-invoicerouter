import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { executionIdentity, reserveRecipient } from '../../shared/runtime/RuntimeStore';
import { normalizedKey, nowIso, toStringValue } from '../../shared/utils/Helpers';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KNOWN: Record<string, string[]> = {
  email: ['email', 'emailaddress', 'customeremail'], name: ['name', 'fullname', 'customername'], phone: ['phone', 'mobile', 'contact'],
  company: ['company', 'organization'], address: ['address', 'street'], country: ['country'], state: ['state', 'province'],
  city: ['city'], zip: ['zip', 'zipcode', 'postalcode'],
};

function field(row: IDataObject, configured: string, aliases: string[]): unknown {
  if (Object.prototype.hasOwnProperty.call(row, configured)) return row[configured];
  const wanted = new Set([normalizedKey(configured), ...aliases]);
  for (const [key, value] of Object.entries(row)) if (wanted.has(normalizedKey(key))) return value;
  return undefined;
}

function generatedName(email: string, mode: string): string {
  const username = email.split('@')[0] || 'customer';
  const formatted = username.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
  if (mode === 'formatted') return formatted || username;
  if (mode === 'firstWord') return (formatted.split(/\s+/)[0] || username);
  return username;
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const batchId = toStringValue(this.getNodeParameter('batchId', 0, 'default'), 'default');
  const emailField = toStringValue(this.getNodeParameter('emailField', 0, 'Email'), 'Email');
  const nameField = toStringValue(this.getNodeParameter('nameField', 0, 'Name'), 'Name');
  const addressField = toStringValue(this.getNodeParameter('addressField', 0, 'Address'), 'Address');
  const nameGeneration = toStringValue(this.getNodeParameter('nameGeneration', 0, 'formatted'));
  const invalidPolicy = toStringValue(this.getNodeParameter('invalidPolicy', 0, 'skip'));
  const preserveCustom = Boolean(this.getNodeParameter('preserveCustomColumns', 0, true));
  const preventReuse = Boolean(this.getNodeParameter('preventReuse', 0, true));
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
    const recognizedKeys = new Set(Object.values(KNOWN).flat());
    const customFields: IDataObject = {};
    if (preserveCustom) {
      for (const [key, value] of Object.entries(item.json)) {
        if (!recognizedKeys.has(normalizedKey(key)) && value !== undefined) customFields[key] = value;
      }
    }
    const recipient: IDataObject = {
      email, name: suppliedName || generatedName(email, nameGeneration),
      phone: toStringValue(field(item.json, 'Phone', KNOWN.phone)), company: toStringValue(field(item.json, 'Company', KNOWN.company)),
      address: toStringValue(field(item.json, addressField, KNOWN.address)), country: toStringValue(field(item.json, 'Country', KNOWN.country)),
      state: toStringValue(field(item.json, 'State', KNOWN.state)), city: toStringValue(field(item.json, 'City', KNOWN.city)),
      zip: toStringValue(field(item.json, 'ZIP Code', KNOWN.zip)), customFields,
    };
    output.push({
      json: { recipient, recipientMeta: { batchId, sourceRow: itemIndex + 2, reserved: preventReuse, normalizedAt: nowIso(), skippedCount: skipped.length }, runtime: { scopeKey: identity.scopeKey } },
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
