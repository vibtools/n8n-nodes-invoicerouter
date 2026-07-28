import type { IDataObject, JsonValue } from '../types/N8n';
import { isRecord, toStringValue } from '../utils/Helpers';

const SECRET_KEY = /(api.?key|secret|token|authorization|password|cookie|session|credential)/i;

export function maskSecret(value: unknown): string {
  const text = toStringValue(value);
  if (!text) return '';
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${text.slice(0, 2)}${'*'.repeat(Math.min(10, text.length - 4))}${text.slice(-2)}`;
}

export function redactString(value: string, secrets: string[] = []): string {
  let output = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]')
    .replace(/token\s+[^\s:]+:[^\s]+/gi, 'token [REDACTED]');
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.split(secret).join('[REDACTED]');
  }
  return output;
}

export function redactJson(value: unknown, secrets: string[] = []): JsonValue {
  if (Array.isArray(value)) return value.map((entry) => redactJson(entry, secrets));
  if (isRecord(value)) {
    const output: IDataObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) output[key] = entry == null ? null : '[REDACTED]';
      else output[key] = redactJson(entry, secrets);
    }
    return output;
  }
  if (typeof value === 'string') return redactString(value, secrets);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return null;
}

export function secretValues(secret: object): string[] {
  return Object.values(secret as Record<string, unknown>).filter((value): value is string => typeof value === 'string' && value.length > 0);
}
