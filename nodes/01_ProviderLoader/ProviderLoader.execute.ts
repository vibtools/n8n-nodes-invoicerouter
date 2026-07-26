import type { IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { isRecord } from '../../shared/utils/Helpers';

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  return [
    items.map((item, itemIndex) => {
      const raw = String(this.getNodeParameter('providersJson', itemIndex, '[]'));
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Providers JSON must be an array.');
      const providerPool = parsed.filter((provider) => isRecord(provider) && provider.enabled !== false);
      return { json: { ...item.json, providerPool }, pairedItem: { item: itemIndex } };
    }),
  ];
}
