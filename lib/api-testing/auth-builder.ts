/**
 * Authentication configuration types
 */
export type AuthType = "none" | "bearer" | "apikey-header" | "apikey-query";

export interface AuthConfig {
  type: AuthType;
  token?: string; // For bearer
  apiKeyName?: string; // For API key (header name or query param name)
  apiKeyValue?: string; // For API key
}

/**
 * Build authentication headers based on config
 */
export function buildAuthHeaders(config: AuthConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (config.type) {
    case "bearer":
      if (config.token) {
        headers["Authorization"] = `Bearer ${config.token}`;
      }
      break;

    case "apikey-header":
      if (config.apiKeyName && config.apiKeyValue) {
        headers[config.apiKeyName] = config.apiKeyValue;
      }
      break;

    // apikey-query is handled in URL, not headers
    case "apikey-query":
    case "none":
    default:
      break;
  }

  return headers;
}

/**
 * Build query string for API key authentication
 */
export function buildAuthQueryParams(config: AuthConfig): string {
  if (config.type === "apikey-query" && config.apiKeyName && config.apiKeyValue) {
    return `${encodeURIComponent(config.apiKeyName)}=${encodeURIComponent(config.apiKeyValue)}`;
  }
  return "";
}

/**
 * Get display name for auth type
 */
export function getAuthTypeLabel(type: AuthType): string {
  switch (type) {
    case "none":
      return "No Authentication";
    case "bearer":
      return "Bearer Token";
    case "apikey-header":
      return "API Key (Header)";
    case "apikey-query":
      return "API Key (Query)";
    default:
      return "Unknown";
  }
}
