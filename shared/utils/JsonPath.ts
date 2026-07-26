import type { IDataObject, JsonValue } from '../types/N8n';
import { isRecord } from './Helpers';

export function parseObject(value: unknown, label: string): IDataObject {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} must contain valid JSON: ${message}`);
  }

  if (!isRecord(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed;
}

export function parseArray(value: unknown, label: string): IDataObject[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (typeof value !== 'string' || value.trim() === '') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} must contain valid JSON: ${message}`);
  }

  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`);
  return parsed.filter(isRecord);
}

export function getByPath(source: unknown, path: string): JsonValue | undefined {
  if (!path.trim()) return undefined;
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  let current: unknown = source;
  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current)) return undefined;
    current = current[part];
  }

  if (
    current === null ||
    typeof current === 'string' ||
    typeof current === 'number' ||
    typeof current === 'boolean' ||
    Array.isArray(current) ||
    isRecord(current)
  ) {
    return current as JsonValue;
  }
  return undefined;
}

export function interpolateString(template: string, values: Record<string, string>): string {
  return template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (match, key: string) => values[key] ?? match);
}

export function interpolateObject(value: JsonValue, values: Record<string, string>): JsonValue {
  if (typeof value === 'string') return interpolateString(value, values);
  if (Array.isArray(value)) return value.map((entry) => interpolateObject(entry, values));
  if (isRecord(value)) {
    const output: IDataObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) output[key] = interpolateObject(entry, values);
    }
    return output;
  }
  return value;
}
