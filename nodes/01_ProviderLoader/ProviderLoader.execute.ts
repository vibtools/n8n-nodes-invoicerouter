import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { isRecord } from '../../shared/utils/Helpers';

const BUILT_INS: IDataObject[] = [
  'custom',
  'stripe',
  'paddle',
  'polar',
  'lemonsqueezy',
  'quickbooks',
  'xero',
  'zoho',
  'erpnext',
  'invoice_ninja',
  'odoo',
].map((id, priority) => ({ id, name: id, enabled: true, priority }));

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();

  return [
    items.map((item, itemIndex) => {
      const includeBuiltIns = Boolean(this.getNodeParameter('includeBuiltIns', itemIndex, true));
      const raw = String(this.getNodeParameter('providersJson', itemIndex, '[]'));
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Providers JSON is invalid: ${message}`);
      }
      if (!Array.isArray(parsed)) throw new Error('Providers JSON must be an array.');

      const customProviders = parsed.filter((provider) => isRecord(provider) && provider.enabled !== false);
      const merged = [...(includeBuiltIns ? BUILT_INS : []), ...customProviders];
      const unique = new Map<string, IDataObject>();
      for (const provider of merged) {
        const id = String(provider.id ?? provider.name ?? '').trim().toLowerCase();
        if (!id) continue;
        unique.set(id, { ...provider, id, enabled: provider.enabled !== false });
      }

      return {
        json: { ...item.json, providerPool: [...unique.values()] },
        pairedItem: { item: itemIndex },
      };
    }),
  ];
}
