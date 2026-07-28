import type { IExecuteFunctions, INodeExecutionData, INodeType } from '../../shared/types/N8n';
import { description } from './ProviderLoader.description';
import { execute } from './ProviderLoader.execute';
export class ProviderLoader implements INodeType {
  description = description;
  execute = execute as (this: IExecuteFunctions) => Promise<INodeExecutionData[][]>;
}
