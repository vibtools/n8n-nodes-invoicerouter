import type { IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { isRecord, toStringValue } from '../../shared/utils/Helpers';

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  return [
    items.map((item, itemIndex) => {
      const dryRun = Boolean(this.getNodeParameter('dryRun', itemIndex, true));
      const provider = isRecord(item.json.selectedProvider)
        ? toStringValue(item.json.selectedProvider.id ?? item.json.selectedProvider.name, 'unselected')
        : 'unselected';
      const invoiceResponse = {
        success: dryRun,
        provider,
        status: dryRun ? 'prepared' : 'not_configured',
        message: dryRun
          ? 'Dry run completed. No external provider request was sent.'
          : 'Provider-specific transport is not configured in the MVP scaffold.',
      };
      return { json: { ...item.json, invoiceResponse }, pairedItem: { item: itemIndex } };
    }),
  ];
}
