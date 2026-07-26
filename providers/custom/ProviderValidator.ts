import type { ProviderConfig } from '../../shared/types/Common';

export function validateProviderConfig(config: ProviderConfig): string[] {
  const errors: string[] = [];
  if (!config.apiUrl) errors.push('apiUrl is required');
  return errors;
}
