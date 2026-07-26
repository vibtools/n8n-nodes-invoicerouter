import type { IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { isRecord } from '../../shared/utils/Helpers';

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  return [
    items.map((item, itemIndex) => {
      const strategy = String(this.getNodeParameter('strategy', itemIndex, 'firstEnabled'));
      const manualProvider = String(this.getNodeParameter('manualProvider', itemIndex, ''));
      const pool = Array.isArray(item.json.providerPool)
        ? item.json.providerPool.filter(isRecord)
        : [];
      const selectedProvider =
        strategy === 'manual'
          ? pool.find((provider) => provider.id === manualProvider || provider.name === manualProvider)
          : pool.find((provider) => provider.enabled !== false);
      return {
        json: { ...item.json, selectedProvider: selectedProvider ?? null },
        pairedItem: { item: itemIndex },
      };
    }),
  ];
}
