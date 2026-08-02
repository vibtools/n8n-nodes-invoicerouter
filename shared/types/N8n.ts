export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | IDataObject | JsonValue[];

export interface IDataObject {
  [key: string]: JsonValue | undefined;
}

export interface INodeExecutionData {
  json: IDataObject;
  pairedItem?: { item: number; input?: number } | Array<{ item: number; input?: number }>;
}

export interface INodePropertyOption {
  name: string;
  value: string | number;
  description?: string;
}

export interface IDisplayOptions {
  show?: Record<string, Array<string | number | boolean>>;
  hide?: Record<string, Array<string | number | boolean>>;
}

export interface INodeProperty {
  displayName: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'options' | 'json';
  default: JsonValue;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: INodePropertyOption[];
  displayOptions?: IDisplayOptions;
  typeOptions?: IDataObject;
}

export interface INodeTypeDescription {
  displayName: string;
  name: string;
  icon?: string | { light: string; dark: string };
  group: string[];
  version: number;
  description: string;
  defaults: { name: string };
  inputs: string[];
  outputs: string[];
  properties: INodeProperty[];
}

export interface IHttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  qs?: Record<string, string>;
  body?: unknown;
  json?: boolean;
  timeout?: number;
  returnFullResponse?: boolean;
  ignoreHttpStatusErrors?: boolean;
}

export interface IExecuteFunctions {
  getInputData(inputIndex?: number): INodeExecutionData[];
  getNodeParameter(name: string, itemIndex: number, fallbackValue?: unknown): unknown;
  continueOnFail(): boolean;
  getNode(): { name: string };
  getExecutionId?(): string;
  getWorkflow?(): { id?: string; name?: string };
  getWorkflowStaticData?(type: 'global' | 'node'): IDataObject;
  helpers: {
    httpRequest(options: IHttpRequestOptions): Promise<unknown>;
  };
}

export interface INodeType {
  description: INodeTypeDescription;
  execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
