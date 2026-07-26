import type { ProviderConfig } from '../../shared/types/Common';

export interface ProviderRuntimeConfig extends ProviderConfig {
  apiUrl: string;
  apiKey?: string;
}
