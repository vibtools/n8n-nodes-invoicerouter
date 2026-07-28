import type { IDataObject, JsonValue } from '../types/N8n';
import { isRecord, toStringValue } from './Helpers';

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function code(seed: string, length: number): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let state = hash(seed) || 1;
  let output = '';
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    output += alphabet[state % alphabet.length];
  }
  return output;
}

export interface DynamicTags {
  INV: string;
  TRX: string;
  RANDOM: string;
  EMAIL: string;
  NAME: string;
  PROVIDER: string;
  ACCOUNT: string;
}

export function buildDynamicTags(seed: string, recipient: IDataObject, provider: IDataObject): DynamicTags {
  return {
    INV: code(`${seed}:invoice`, 12),
    TRX: code(`${seed}:transaction`, 16),
    RANDOM: code(`${seed}:random`, 13),
    EMAIL: toStringValue(recipient.email),
    NAME: toStringValue(recipient.name),
    PROVIDER: toStringValue(provider.providerId ?? provider.provider),
    ACCOUNT: toStringValue(provider.accountId ?? provider.account),
  };
}

export function replaceTagsInString(value: string, tags: DynamicTags): string {
  return value.replace(/#(INV|TRX|RANDOM|EMAIL|NAME|PROVIDER|ACCOUNT)#/g, (_match, key: keyof DynamicTags) => tags[key]);
}

export function replaceTags(value: JsonValue, tags: DynamicTags): JsonValue {
  if (typeof value === 'string') return replaceTagsInString(value, tags);
  if (Array.isArray(value)) return value.map((entry) => replaceTags(entry, tags));
  if (isRecord(value)) {
    const output: IDataObject = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = entry === undefined ? undefined : replaceTags(entry, tags);
    }
    return output;
  }
  return value;
}
