import type { IDataObject, JsonValue } from '../types/N8n';
import { isRecord, toStringValue } from '../utils/Helpers';

const SECRET_KEY = /(api.?key|secret|token|authorization|password|cookie|session|credential)/i;
const TOKEN_CHARACTER = /[A-Za-z0-9_]/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceShortSecret(value: string, secret: string): string {
  if (!secret) return value;
  if (value === secret) return '[REDACTED]';

  const escaped = escapeRegExp(secret);
  const firstIsToken = TOKEN_CHARACTER.test(secret[0] ?? '');
  const lastIsToken = TOKEN_CHARACTER.test(secret.at(-1) ?? '');

  // Short alphanumeric secrets are only replaced when they are complete tokens.
  // This prevents values such as "a" or "db" from corrupting normal words like
  // "database" while still redacting query parameters, headers, JSON fragments,
  // command-line arguments, and standalone error details.
  if (firstIsToken || lastIsToken) {
    const leftBoundary = firstIsToken ? '(?<![A-Za-z0-9_])' : '';
    const rightBoundary = lastIsToken ? '(?![A-Za-z0-9_])' : '';
    return value.replace(new RegExp(`${leftBoundary}${escaped}${rightBoundary}`, 'g'), '[REDACTED]');
  }

  // Pure-punctuation secrets of four characters or fewer are too ambiguous for
  // blind global replacement. Redact them only as a complete value or when they
  // appear in an assignment/quoted token context.
  const assignmentPattern = new RegExp(`([:=]\\s*["']?)${escaped}(["']?(?=$|[\\s,;}&\\]]))`, 'g');
  return value.replace(assignmentPattern, '$1[REDACTED]$2');
}

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

  const uniqueSecrets = [...new Set(secrets.map((secret) => toStringValue(secret)).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  for (const secret of uniqueSecrets) {
    output = secret.length <= 4
      ? replaceShortSecret(output, secret)
      : output.split(secret).join('[REDACTED]');
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
  return [...new Set(Object.values(secret as Record<string, unknown>)
    .filter((value): value is string => typeof value === 'string' && value.length > 0))];
}
