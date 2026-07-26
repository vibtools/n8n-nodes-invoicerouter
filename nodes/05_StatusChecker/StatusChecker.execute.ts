import type { IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { isRecord, toStringValue } from '../../shared/utils/Helpers';

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  return [
    items.map((item, itemIndex) => {
      const statusField = String(this.getNodeParameter('statusField', itemIndex, 'status'));
      const response = isRecord(item.json.invoiceResponse) ? item.json.invoiceResponse : {};
      const status = toStringValue(response[statusField] ?? item.json[statusField], 'unknown').toLowerCase();
      return {
        json: { ...item.json, normalizedStatus: status },
        pairedItem: { item: itemIndex },
      };
    }),
  ];
}
