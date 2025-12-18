import type {
  SwaggerDocument,
  TagInfo,
  EndpointInfo,
  OperationObject,
} from "@/lib/types/swagger";
import { extractParams, extractRequestBodyWithType, extractResponse } from "./schema-resolver";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

/**
 * Analyze all tags in the swagger document and return statistics
 * Ported from Python: analyze_tags()
 */
export function analyzeTags(swagger: SwaggerDocument): Map<string, TagInfo> {
  const tagsInfo = new Map<string, TagInfo>();

  for (const [path, pathItem] of Object.entries(swagger.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OperationObject | undefined;
      if (!operation) continue;

      const endpointTags = operation.tags?.length ? operation.tags : ["Untagged"];

      for (const tag of endpointTags) {
        if (!tagsInfo.has(tag)) {
          tagsInfo.set(tag, {
            name: tag,
            total: 0,
            methods: {},
            paths: [],
          });
        }

        const info = tagsInfo.get(tag)!;
        const upperMethod = method.toUpperCase();

        info.total++;
        info.methods[upperMethod] = (info.methods[upperMethod] || 0) + 1;

        const endpoint: EndpointInfo = {
          path,
          method: upperMethod,
        };

        if (operation.summary) {
          endpoint.summary = operation.summary;
        }

        const params = extractParams(operation);
        if (params.length > 0) {
          endpoint.params = params;
        }

        const bodyInfo = extractRequestBodyWithType(operation);
        if (bodyInfo.schema) {
          endpoint.body = bodyInfo.schema;
        }
        if (bodyInfo.contentType) {
          endpoint.bodyContentType = bodyInfo.contentType;
        }

        const response = extractResponse(operation);
        if (response) {
          endpoint.response = response;
        }

        info.paths.push(endpoint);
      }
    }
  }

  return tagsInfo;
}

/**
 * Sort tags by name
 */
export function sortTagsByName(tags: Map<string, TagInfo>): TagInfo[] {
  return Array.from(tags.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sort tags by endpoint count (descending)
 */
export function sortTagsByCount(tags: Map<string, TagInfo>): TagInfo[] {
  return Array.from(tags.values()).sort((a, b) => b.total - a.total);
}
