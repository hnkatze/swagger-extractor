import type { SwaggerDocument, Server, SecurityScheme } from "@/lib/types/swagger";

export interface ParseResult {
  success: boolean;
  data?: SwaggerDocument;
  error?: string;
}

/**
 * Parse and validate a swagger.json string
 */
export function parseSwagger(jsonString: string): ParseResult {
  try {
    const parsed = JSON.parse(jsonString);

    // Validate required fields
    if (!parsed.info) {
      return { success: false, error: "Missing 'info' section" };
    }

    if (!parsed.info.title) {
      return { success: false, error: "Missing 'info.title'" };
    }

    if (!parsed.paths) {
      return { success: false, error: "Missing 'paths' section" };
    }

    // Check if it's OpenAPI 3.x or Swagger 2.x
    if (!parsed.openapi && !parsed.swagger) {
      return { success: false, error: "Not a valid OpenAPI/Swagger document" };
    }

    return { success: true, data: parsed as SwaggerDocument };
  } catch {
    return { success: false, error: "Invalid JSON format" };
  }
}

/**
 * Get schemas from swagger document (handles both OpenAPI 3.x and Swagger 2.x)
 */
export function getSchemas(swagger: SwaggerDocument): Record<string, unknown> {
  // OpenAPI 3.x uses components.schemas
  if (swagger.components?.schemas) {
    return swagger.components.schemas;
  }
  // Swagger 2.x uses definitions
  if (swagger.definitions) {
    return swagger.definitions;
  }
  return {};
}

/**
 * Get the schema reference path prefix based on swagger version
 */
export function getSchemaRefPrefix(swagger: SwaggerDocument): string {
  if (swagger.openapi) {
    return "#/components/schemas/";
  }
  return "#/definitions/";
}

/**
 * Get servers/base URLs from swagger document
 * Handles both OpenAPI 3.x (servers array) and Swagger 2.0 (host/basePath)
 */
export function getServers(swagger: SwaggerDocument): Server[] {
  // OpenAPI 3.x: use servers array directly
  if (swagger.servers?.length) {
    return swagger.servers;
  }

  // Swagger 2.0: construct URL from host + basePath
  if (swagger.host) {
    const scheme = swagger.schemes?.[0] || "https";
    const basePath = swagger.basePath || "";
    return [
      {
        url: `${scheme}://${swagger.host}${basePath}`,
        description: "Default server",
      },
    ];
  }

  return [];
}

/**
 * Get security schemes from swagger document
 * Handles both OpenAPI 3.x and Swagger 2.0
 */
export function getSecuritySchemes(
  swagger: SwaggerDocument
): Record<string, SecurityScheme> {
  // OpenAPI 3.x uses components.securitySchemes
  if (swagger.components?.securitySchemes) {
    return swagger.components.securitySchemes;
  }
  // Swagger 2.0 uses securityDefinitions
  if (swagger.securityDefinitions) {
    return swagger.securityDefinitions;
  }
  return {};
}
