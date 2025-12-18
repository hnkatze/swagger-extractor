import type { ProxyResponse } from "@/app/api/proxy/route";
import { AuthConfig, buildAuthHeaders, buildAuthQueryParams } from "./auth-builder";

export interface RequestConfig {
  baseUrl: string;
  path: string;
  method: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
  file?: File;
  contentType?: string;
  auth: AuthConfig;
}

export interface ExecutionResult {
  success: boolean;
  response?: ProxyResponse;
  error?: string;
}

/**
 * Resolve path parameters in URL
 * e.g., /pets/{petId} with { petId: "123" } becomes /pets/123
 */
export function resolvePathParams(
  path: string,
  params: Record<string, string>
): string {
  let resolvedPath = path;
  for (const [key, value] of Object.entries(params)) {
    resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
  }
  return resolvedPath;
}

/**
 * Extract path parameter names from a path
 * e.g., /pets/{petId}/photos/{photoId} returns ["petId", "photoId"]
 */
export function extractPathParamNames(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * Build the full URL with query parameters
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  queryParams: Record<string, string>,
  auth: AuthConfig
): string {
  // Ensure baseUrl doesn't end with / and path starts with /
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  let url = `${cleanBase}${cleanPath}`;

  // Build query string
  const queryParts: string[] = [];

  // Add regular query params
  for (const [key, value] of Object.entries(queryParams)) {
    if (value) {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  // Add API key query param if configured
  const authQuery = buildAuthQueryParams(auth);
  if (authQuery) {
    queryParts.push(authQuery);
  }

  if (queryParts.length > 0) {
    url += `?${queryParts.join("&")}`;
  }

  return url;
}

/**
 * Execute an HTTP request through the proxy
 */
export async function executeRequest(
  config: RequestConfig
): Promise<ExecutionResult> {
  try {
    // Resolve path parameters
    const resolvedPath = config.pathParams
      ? resolvePathParams(config.path, config.pathParams)
      : config.path;

    // Build full URL
    const url = buildUrl(
      config.baseUrl,
      resolvedPath,
      config.queryParams || {},
      config.auth
    );

    // Build headers
    const authHeaders = buildAuthHeaders(config.auth);

    // Check if this is a file upload
    const isFileUpload = config.file !== undefined;

    if (isFileUpload && config.file) {
      // Use FormData for file uploads
      const formData = new FormData();
      formData.append("url", url);
      formData.append("method", config.method);
      formData.append("authHeaders", JSON.stringify(authHeaders));
      formData.append("file", config.file);
      if (config.contentType) {
        formData.append("contentType", config.contentType);
      }

      const proxyResponse = await fetch("/api/proxy/upload", {
        method: "POST",
        body: formData,
      });

      const result = await proxyResponse.json();

      if (result.error && result.status === 0) {
        return { success: false, error: result.error };
      }

      return { success: true, response: result as ProxyResponse };
    } else {
      // Regular JSON request
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...authHeaders,
        ...config.headers,
      };

      const proxyResponse = await fetch("/api/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          method: config.method,
          headers,
          body: config.body,
        }),
      });

      const result = await proxyResponse.json();

      if (result.error && result.status === 0) {
        return { success: false, error: result.error };
      }

      return { success: true, response: result as ProxyResponse };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get status code color class
 */
export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-emerald-600 dark:text-emerald-400";
  if (status >= 300 && status < 400) return "text-blue-600 dark:text-blue-400";
  if (status >= 400 && status < 500) return "text-amber-600 dark:text-amber-400";
  if (status >= 500) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

/**
 * Format response body for display
 */
export function formatResponseBody(body: string, contentType?: string): string {
  // Try to format as JSON if it looks like JSON
  if (contentType?.includes("application/json") || body.trim().startsWith("{") || body.trim().startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}
