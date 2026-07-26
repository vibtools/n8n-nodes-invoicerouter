export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | IDataObject | JsonValue[];

export interface IDataObject {
  [key: string]: JsonValue | undefined;
}

export interface INodeExecutionData {
  json: IDataObject;
  pairedItem?: { item: number; input?: number };
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

export interface INodeCredentialDescription {
  name: string;
  required?: boolean;
}

export interface INodeTypeDescription {
  displayName: string;
  name: string;
  group: string[];
  version: number;
  description: string;
  defaults: { name: string };
  inputs: string[];
  outputs: string[];
  credentials?: INodeCredentialDescription[];
  properties: INodeProperty[];
}

export interface ICredentialDataDecryptedObject {
  [key: string]: unknown;
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
  getInputData(): INodeExecutionData[];
  getNodeParameter(name: string, itemIndex: number, fallbackValue?: unknown): unknown;
  getCredentials(name: string, itemIndex?: number): Promise<ICredentialDataDecryptedObject>;
  continueOnFail(): boolean;
  getNode(): { name: string };
  helpers: {
    httpRequest(options: IHttpRequestOptions): Promise<unknown>;
  };
}

export interface INodeType {
  description: INodeTypeDescription;
  execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}

export interface ICredentialType {
  name: string;
  displayName: string;
  documentationUrl?: string;
  properties: INodeProperty[];
}
