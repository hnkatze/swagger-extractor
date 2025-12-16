import type {
  SwaggerDocument,
  TagInfo,
  ExtractionResult,
  SchemaObject,
} from "@/lib/types/swagger";
import { getSchemas } from "./parser";
import { findAllSchemaRefs } from "./schema-resolver";
import { simplifySchema } from "./schema-simplifier";

/**
 * Extract endpoints by selected tags
 * Ported from Python: extract_by_tags()
 */
export function extractByTags(
  swagger: SwaggerDocument,
  selectedTags: string[],
  tagsInfo: Map<string, TagInfo>
): ExtractionResult {
  const info = swagger.info;
  const allSchemas = getSchemas(swagger) as Record<string, SchemaObject>;

  const result: ExtractionResult = {
    api: `${info.title || "API"} v${info.version || "1.0"}`,
    extracted_tags: selectedTags,
    endpoints: {},
    schemas: {},
  };

  const usedSchemas = new Set<string>();

  // Extract endpoints by tag
  for (const tag of selectedTags) {
    const tagData = tagsInfo.get(tag);
    if (!tagData) continue;

    result.endpoints[tag] = [];

    for (const endpoint of tagData.paths) {
      const endpointData = {
        path: endpoint.path,
        method: endpoint.method,
        summary: endpoint.summary,
        params: endpoint.params,
        body: endpoint.body,
        response: endpoint.response,
      };

      // Track used schemas
      if (endpoint.body) {
        usedSchemas.add(endpoint.body.replace("[]", ""));
      }
      if (endpoint.response) {
        usedSchemas.add(endpoint.response.replace("[]", ""));
      }

      result.endpoints[tag].push(endpointData);
    }
  }

  // Find dependent schemas recursively
  const schemasToProcess = Array.from(usedSchemas);
  while (schemasToProcess.length > 0) {
    const schemaName = schemasToProcess.pop()!;
    if (allSchemas[schemaName]) {
      const nestedRefs = findAllSchemaRefs(allSchemas[schemaName]);
      for (const ref of nestedRefs) {
        if (!usedSchemas.has(ref)) {
          usedSchemas.add(ref);
          schemasToProcess.push(ref);
        }
      }
    }
  }

  // Simplify schemas
  for (const schemaName of Array.from(usedSchemas).sort()) {
    if (allSchemas[schemaName]) {
      result.schemas[schemaName] = simplifySchema(
        allSchemas[schemaName],
        allSchemas
      );
    }
  }

  return result;
}
