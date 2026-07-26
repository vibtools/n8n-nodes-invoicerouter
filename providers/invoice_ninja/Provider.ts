import { BaseProvider, type PreparedProviderRequest } from '../../shared/core/BaseProvider';
import type { ProviderConfig, StandardInvoiceResponse, UniversalInvoice } from '../../shared/types/Common';
import { PROVIDER_DISPLAY_NAME, PROVIDER_ID } from './ProviderConstants';
import { bearerToken } from './ProviderHelpers';
import { buildProviderPayload } from './ProviderPayload';
import { parseProviderResponse } from './ProviderParser';
import { validateProviderConfig } from './ProviderValidator';

export class InvoiceNinjaProvider extends BaseProvider {
  readonly id = PROVIDER_ID;
  readonly displayName = PROVIDER_DISPLAY_NAME;

  validateConfig(config: ProviderConfig): string[] {
    return validateProviderConfig(config);
  }

  prepareInvoiceRequest(invoice: UniversalInvoice, config: ProviderConfig): PreparedProviderRequest {
    if (!config.apiUrl) throw new Error(`${PROVIDER_DISPLAY_NAME} apiUrl is required.`);
    return {
      url: config.apiUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearerToken(config.apiKey) },
      body: buildProviderPayload(invoice),
    };
  }

  parseInvoiceResponse(response: unknown): StandardInvoiceResponse {
    return parseProviderResponse(response);
  }
}
