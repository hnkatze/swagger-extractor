import type { DeepSchemaField } from "@/lib/swagger/schema-simplifier";
import { executeRequest } from "./request-executor";

/**
 * Auto Auth configuration types and utilities
 */

export interface AutoAuthEndpointConfig {
  path: string;
  method: string;
  summary?: string;
  bodySchema?: string;
  responseSchema?: string;
}

export interface AutoAuthConfig {
  loginEndpoint: AutoAuthEndpointConfig;
  refreshEndpoint?: AutoAuthEndpointConfig;
  credentials: Record<string, string>;
  tokenFieldPath: string;
  refreshTokenFieldPath?: string;
  refreshBodyFieldPath?: string;
  autoRefresh: boolean;
}

export interface AutoAuthState {
  config: AutoAuthConfig | null;
  accessToken: string | null;
  refreshToken: string | null;
  obtainedAt: number | null;
  status: "idle" | "authenticating" | "authenticated" | "refreshing" | "error";
  error?: string;
}

export const INITIAL_AUTO_AUTH_STATE: AutoAuthState = {
  config: null,
  accessToken: null,
  refreshToken: null,
  obtainedAt: null,
  status: "idle",
};

export interface FieldMapping {
  fieldPath: string;
  label: string;
}

// --- Utility functions ---

/**
 * Extract a value from a nested object by dot-path
 * e.g., getNestedValue({ data: { accessToken: "eyJ..." }}, "data.accessToken") → "eyJ..."
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Flatten a DeepSchemaField tree into selectable dot-path options.
 * Only includes string-type leaf fields (potential token fields).
 */
export function flattenSchemaToFieldPaths(
  fields: Record<string, DeepSchemaField>,
  prefix: string = ""
): FieldMapping[] {
  const result: FieldMapping[] = [];

  for (const [key, field] of Object.entries(fields)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;

    if (field.type.startsWith("string") || field.type === "any") {
      result.push({ fieldPath: fullPath, label: `${fullPath} (${field.type})` });
    }

    if (field.fields) {
      result.push(...flattenSchemaToFieldPaths(field.fields, fullPath));
    }
  }

  return result;
}

/**
 * Flatten schema fields into input field definitions for credential forms.
 * Returns ALL top-level fields (not just strings), for building the login form.
 */
export function flattenSchemaToFormFields(
  fields: Record<string, DeepSchemaField>
): Array<{ name: string; type: string }> {
  return Object.entries(fields).map(([name, field]) => ({
    name,
    type: field.type,
  }));
}

/**
 * Heuristic: determine HTML input type for a credential field
 */
export function getInputType(fieldName: string): string {
  const lower = fieldName.toLowerCase();
  if (lower.includes("pass") || lower.includes("secret") || lower.includes("pin")) {
    return "password";
  }
  if (lower.includes("email")) {
    return "email";
  }
  return "text";
}

/**
 * Heuristic: rank token field paths by likelihood of being the access token
 */
const TOKEN_KEYWORDS = ["accesstoken", "access_token", "token", "jwt", "bearer", "id_token"];
const REFRESH_KEYWORDS = ["refreshtoken", "refresh_token", "refresh"];

export function rankTokenFields(fields: FieldMapping[]): FieldMapping[] {
  return [...fields].sort((a, b) => {
    const aLower = a.fieldPath.toLowerCase();
    const bLower = b.fieldPath.toLowerCase();
    const aScore = TOKEN_KEYWORDS.reduce((s, kw) => s + (aLower.includes(kw) ? 1 : 0), 0);
    const bScore = TOKEN_KEYWORDS.reduce((s, kw) => s + (bLower.includes(kw) ? 1 : 0), 0);
    return bScore - aScore;
  });
}

export function rankRefreshFields(fields: FieldMapping[]): FieldMapping[] {
  return [...fields].sort((a, b) => {
    const aLower = a.fieldPath.toLowerCase();
    const bLower = b.fieldPath.toLowerCase();
    const aScore = REFRESH_KEYWORDS.reduce((s, kw) => s + (aLower.includes(kw) ? 1 : 0), 0);
    const bScore = REFRESH_KEYWORDS.reduce((s, kw) => s + (bLower.includes(kw) ? 1 : 0), 0);
    return bScore - aScore;
  });
}

// --- Auth endpoint ranking ---

const AUTH_KEYWORDS = ["auth", "login", "signin", "sign-in", "token", "session", "authenticate"];
const REFRESH_EP_KEYWORDS = ["refresh", "renew", "token/refresh"];

export function rankAuthEndpoints<T extends { path: string }>(endpoints: T[]): T[] {
  return [...endpoints].sort((a, b) => {
    const aLower = a.path.toLowerCase();
    const bLower = b.path.toLowerCase();
    const aScore = AUTH_KEYWORDS.reduce((s, kw) => s + (aLower.includes(kw) ? 1 : 0), 0);
    const bScore = AUTH_KEYWORDS.reduce((s, kw) => s + (bLower.includes(kw) ? 1 : 0), 0);
    return bScore - aScore;
  });
}

export function rankRefreshEndpoints<T extends { path: string }>(endpoints: T[]): T[] {
  return [...endpoints].sort((a, b) => {
    const aLower = a.path.toLowerCase();
    const bLower = b.path.toLowerCase();
    const aScore = REFRESH_EP_KEYWORDS.reduce((s, kw) => s + (aLower.includes(kw) ? 1 : 0), 0);
    const bScore = REFRESH_EP_KEYWORDS.reduce((s, kw) => s + (bLower.includes(kw) ? 1 : 0), 0);
    return bScore - aScore;
  });
}

// --- Execute login/refresh ---

interface AutoLoginResult {
  accessToken: string;
  refreshToken?: string;
}

export async function executeAutoLogin(
  baseUrl: string,
  config: AutoAuthConfig
): Promise<{ ok: true; data: AutoLoginResult } | { ok: false; error: string }> {
  const result = await executeRequest({
    baseUrl,
    path: config.loginEndpoint.path,
    method: config.loginEndpoint.method,
    body: JSON.stringify(config.credentials),
    auth: { type: "none" },
  });

  if (!result.success || !result.response) {
    return { ok: false, error: result.error || "Request failed" };
  }

  if (result.response.status < 200 || result.response.status >= 300) {
    return {
      ok: false,
      error: `Login failed: ${result.response.status} ${result.response.statusText}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.response.body);
  } catch {
    return { ok: false, error: "Response is not valid JSON" };
  }

  const accessToken = getNestedValue(parsed, config.tokenFieldPath);
  if (typeof accessToken !== "string" || !accessToken) {
    return {
      ok: false,
      error: `Could not find token at path "${config.tokenFieldPath}". Response: ${result.response.body.slice(0, 200)}`,
    };
  }

  let refreshToken: string | undefined;
  if (config.refreshTokenFieldPath) {
    const rt = getNestedValue(parsed, config.refreshTokenFieldPath);
    if (typeof rt === "string" && rt) {
      refreshToken = rt;
    }
  }

  return { ok: true, data: { accessToken, refreshToken } };
}

export async function executeAutoRefresh(
  baseUrl: string,
  config: AutoAuthConfig,
  currentRefreshToken: string
): Promise<{ ok: true; data: AutoLoginResult } | { ok: false; error: string }> {
  if (!config.refreshEndpoint) {
    return { ok: false, error: "No refresh endpoint configured" };
  }

  const bodyField = config.refreshBodyFieldPath || "refreshToken";
  const body = JSON.stringify({ [bodyField]: currentRefreshToken });

  const result = await executeRequest({
    baseUrl,
    path: config.refreshEndpoint.path,
    method: config.refreshEndpoint.method,
    body,
    auth: { type: "none" },
  });

  if (!result.success || !result.response) {
    return { ok: false, error: result.error || "Refresh request failed" };
  }

  if (result.response.status < 200 || result.response.status >= 300) {
    return {
      ok: false,
      error: `Refresh failed: ${result.response.status} ${result.response.statusText}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.response.body);
  } catch {
    return { ok: false, error: "Refresh response is not valid JSON" };
  }

  const accessToken = getNestedValue(parsed, config.tokenFieldPath);
  if (typeof accessToken !== "string" || !accessToken) {
    return { ok: false, error: `Could not find token at path "${config.tokenFieldPath}"` };
  }

  let refreshToken: string | undefined;
  if (config.refreshTokenFieldPath) {
    const rt = getNestedValue(parsed, config.refreshTokenFieldPath);
    if (typeof rt === "string" && rt) {
      refreshToken = rt;
    }
  }

  return { ok: true, data: { accessToken, refreshToken } };
}

// --- localStorage persistence ---

function getStorageKey(apiTitle: string, apiVersion: string): string {
  return `auto-auth:${apiTitle}-${apiVersion}`;
}

export function saveAutoAuthConfig(
  apiTitle: string,
  apiVersion: string,
  config: AutoAuthConfig
): void {
  try {
    const key = getStorageKey(apiTitle, apiVersion);
    localStorage.setItem(key, JSON.stringify(config));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadAutoAuthConfig(
  apiTitle: string,
  apiVersion: string
): AutoAuthConfig | null {
  try {
    const key = getStorageKey(apiTitle, apiVersion);
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as AutoAuthConfig;
  } catch {
    return null;
  }
}

export function clearAutoAuthConfig(apiTitle: string, apiVersion: string): void {
  try {
    const key = getStorageKey(apiTitle, apiVersion);
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}
