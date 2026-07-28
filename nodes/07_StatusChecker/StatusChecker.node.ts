import type { IExecuteFunctions, INodeExecutionData, INodeType } from '../../shared/types/N8n';
import { description } from './StatusChecker.description';
import { execute } from './StatusChecker.execute';
export class StatusChecker implements INodeType {
  description = description;
  execute = execute as (this: IExecuteFunctions) => Promise<INodeExecutionData[][]>;
}
