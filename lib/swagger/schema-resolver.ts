import type { SchemaObject, OperationObject } from "@/lib/types/swagger";

/**
 * Get the schema name from a $ref
 * Ported from Python: get_schema_ref()
 */
export function getSchemaRef(obj: SchemaObject | undefined): string | null {
  if (!obj) return null;

  if (obj.$ref) {
    return obj.$ref.split("/").pop() || null;
  }

  if (obj.items?.$ref) {
    const refName = obj.items.$ref.split("/").pop();
    return refName ? `${refName}[]` : null;
  }

  return null;
}

/**
 * Find all schema references recursively in an object
 * Ported from Python: find_all_schema_refs()
 */
export function findAllSchemaRefs(obj: unknown, refs: Set<string> = new Set()): Set<string> {
  if (obj === null || obj === undefined) return refs;

  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        findAllSchemaRefs(item, refs);
      }
    } else {
      const record = obj as Record<string, unknown>;

      // Check for $ref
      if (
        typeof record.$ref === "string" &&
        (record.$ref.includes("#/components/schemas/") ||
          record.$ref.includes("#/definitions/"))
      ) {
        const refName = record.$ref.split("/").pop();
        if (refName) refs.add(refName);
      }

      // Recurse into object values
      for (const value of Object.values(record)) {
        findAllSchemaRefs(value, refs);
      }
    }
  }

  return refs;
}

/**
 * Extract parameters from an operation
 * Ported from Python: extract_params()
 */
export function extractParams(operation: OperationObject): string[] {
  const params: string[] = [];

  for (const param of operation.parameters || []) {
    let paramInfo = param.name;
    if (param.required) {
      paramInfo += "*";
    }
    if (param.in) {
      paramInfo += `(${param.in})`;
    }
    params.push(paramInfo);
  }

  return params;
}

export interface RequestBodyInfo {
  schema: string | null;
  contentType: string | null;
}

/**
 * Extract the request body schema reference and content type
 * Ported from Python: extract_request_body()
 */
export function extractRequestBody(operation: OperationObject): string | null {
  return extractRequestBodyWithType(operation).schema;
}

/**
 * Extract full request body info including content type
 * Used for detecting file uploads (multipart/form-data, application/octet-stream)
 */
export function extractRequestBodyWithType(operation: OperationObject): RequestBodyInfo {
  const requestBody = operation.requestBody;
  if (!requestBody?.content) return { schema: null, contentType: null };

  // Priority order - check what content types are available
  const contentTypePriority = [
    "application/json",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
    "application/octet-stream",
    "*/*",
  ];

  // First, try to find by priority
  for (const contentType of contentTypePriority) {
    const content = requestBody.content[contentType];
    if (content) {
      return {
        schema: content.schema ? getSchemaRef(content.schema) : null,
        contentType,
      };
    }
  }

  // If none found in priority, take the first available
  const availableTypes = Object.keys(requestBody.content);
  if (availableTypes.length > 0) {
    const contentType = availableTypes[0];
    const content = requestBody.content[contentType];
    return {
      schema: content?.schema ? getSchemaRef(content.schema) : null,
      contentType,
    };
  }

  return { schema: null, contentType: null };
}

/**
 * Extract the response schema reference
 * Ported from Python: extract_response()
 */
export function extractResponse(operation: OperationObject): string | null {
  const responses = operation.responses;
  if (!responses) return null;

  const successStatuses = ["200", "201", "202"];

  for (const status of successStatuses) {
    const response = responses[status];
    if (response?.content?.["application/json"]?.schema) {
      return getSchemaRef(response.content["application/json"].schema);
    }
  }

  return null;
}
