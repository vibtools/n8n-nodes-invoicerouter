import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { isRecord, toStringValue } from '../../shared/utils/Helpers';

function normalizedProvider(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();

  return [
    items.map((item, itemIndex) => {
      const strategy = String(this.getNodeParameter('strategy', itemIndex, 'inputField'));
      const manualProvider = normalizedProvider(this.getNodeParameter('manualProvider', itemIndex, 'custom'));
      const providerField = String(this.getNodeParameter('providerField', itemIndex, 'provider'));
      const pool = Array.isArray(item.json.providerPool) ? item.json.providerPool.filter(isRecord) : [];

      let requestedProvider = '';
      if (strategy === 'manual') requestedProvider = manualProvider;
      else if (strategy === 'inputField') requestedProvider = normalizedProvider(item.json[providerField]);

      let selectedProvider: IDataObject | undefined;
      if (requestedProvider) {
        selectedProvider = pool.find((provider) => {
          const id = normalizedProvider(provider.id ?? provider.name);
          return id === requestedProvider && provider.enabled !== false;
        });
        selectedProvider ??= { id: requestedProvider, name: requestedProvider, enabled: true };
      } else {
        selectedProvider = pool.find((provider) => provider.enabled !== false);
      }

      if (!selectedProvider) throw new Error(`Item ${itemIndex}: no enabled invoice provider could be selected.`);

      const providerId = toStringValue(selectedProvider.id ?? selectedProvider.name, 'custom');
      return {
        json: { ...item.json, provider: providerId, selectedProvider },
        pairedItem: { item: itemIndex },
      };
    }),
  ];
}
