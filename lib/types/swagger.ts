// OpenAPI/Swagger document types

export interface SwaggerInfo {
  title: string;
  version: string;
  description?: string;
}

export interface SwaggerParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required?: boolean;
  schema?: SchemaObject;
  description?: string;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  $ref?: string;
  items?: SchemaObject;
  properties?: Record<string, SchemaObject>;
  enum?: (string | number | boolean)[];
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
}

export interface RequestBody {
  content?: Record<string, { schema?: SchemaObject }>;
  required?: boolean;
}

export interface Response {
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
}

export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: SwaggerParameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  trace?: OperationObject;
}

export interface SwaggerDocument {
  openapi?: string;
  swagger?: string;
  info: SwaggerInfo;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
  definitions?: Record<string, SchemaObject>; // Swagger 2.0
}

// Application types

export interface EndpointInfo {
  path: string;
  method: string;
  summary?: string;
  params?: string[];
  body?: string;
  response?: string;
}

export interface TagInfo {
  name: string;
  total: number;
  methods: Record<string, number>;
  paths: EndpointInfo[];
}

export interface ExtractionResult {
  api: string;
  extracted_tags: string[];
  endpoints: Record<string, EndpointInfo[]>;
  schemas: Record<string, Record<string, string>>;
}
