import type { IExecuteFunctions, INodeExecutionData } from '../types/N8n';

export function safeInputData(context: IExecuteFunctions, inputIndex: number): INodeExecutionData[] {
  try {
    return context.getInputData(inputIndex);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/could not get input with given index|input.*index.*not.*available/i.test(message)) return [];
    throw error;
  }
}
