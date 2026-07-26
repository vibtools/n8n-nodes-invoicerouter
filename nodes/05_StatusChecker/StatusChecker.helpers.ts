export function normalizeText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}
