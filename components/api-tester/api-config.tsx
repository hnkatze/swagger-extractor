"use client";

import { Server, ChevronDown, Info, LogIn, RefreshCw, X, Check, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { SwaggerDocument, TagInfo, Server as ServerType, SecurityScheme } from "@/lib/types/swagger";
import { getServers, getSecuritySchemes } from "@/lib/swagger/parser";
import {
  AuthType,
  AuthConfig,
  getAuthTypeLabel,
} from "@/lib/api-testing/auth-builder";
import { useMemo, useState, useEffect } from "react";
import { AutoAuthDialog } from "./auto-auth-dialog";
import type { AutoAuthState, AutoAuthConfig } from "@/lib/api-testing/auto-auth";

// Helper to convert swagger security scheme to our auth type
interface DetectedAuth {
  type: AuthType;
  name: string;
  apiKeyName?: string;
  apiKeyIn?: "header" | "query";
}

function detectAuthFromSchemes(schemes: Record<string, SecurityScheme>): DetectedAuth[] {
  const detected: DetectedAuth[] = [];

  for (const [name, scheme] of Object.entries(schemes)) {
    if (scheme.type === "http" && scheme.scheme === "bearer") {
      detected.push({ type: "bearer", name });
    } else if (scheme.type === "apiKey") {
      const authType = scheme.in === "query" ? "apikey-query" : "apikey-header";
      detected.push({
        type: authType,
        name,
        apiKeyName: scheme.name,
        apiKeyIn: scheme.in as "header" | "query"
      });
    }
  }

  return detected;
}

export interface ApiConfigState {
  baseUrl: string;
  auth: AuthConfig;
}

interface ApiConfigProps {
  swagger: SwaggerDocument;
  config: ApiConfigState;
  onConfigChange: (config: ApiConfigState) => void;
  tagsInfo?: Map<string, TagInfo>;
  autoAuthState?: AutoAuthState;
  onAutoAuthComplete?: (accessToken: string, refreshToken: string | undefined, config: AutoAuthConfig) => void;
  onAutoAuthClear?: () => void;
}

export function ApiConfig({
  swagger,
  config,
  onConfigChange,
  tagsInfo,
  autoAuthState,
  onAutoAuthComplete,
  onAutoAuthClear,
}: ApiConfigProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [autoAuthOpen, setAutoAuthOpen] = useState(false);

  // Get servers from swagger
  const servers = useMemo(() => getServers(swagger), [swagger]);

  // Get detected auth schemes from swagger
  const detectedAuth = useMemo(() => {
    const schemes = getSecuritySchemes(swagger);
    return detectAuthFromSchemes(schemes);
  }, [swagger]);

  // Auth state
  const [authType, setAuthType] = useState<AuthType>(config.auth.type);
  const [bearerToken, setBearerToken] = useState(config.auth.token || "");
  const [apiKeyName, setApiKeyName] = useState(config.auth.apiKeyName || "");
  const [apiKeyValue, setApiKeyValue] = useState(config.auth.apiKeyValue || "");

  // Auto-configure auth when detected schemes change (on new swagger load)
  useEffect(() => {
    if (detectedAuth.length > 0 && config.auth.type === "none") {
      const first = detectedAuth[0];
      setAuthType(first.type);
      if (first.apiKeyName) {
        setApiKeyName(first.apiKeyName);
      }
      // Update config with detected auth type and key name
      const newAuth: AuthConfig = first.type === "bearer"
        ? { type: "bearer", token: "" }
        : { type: first.type, apiKeyName: first.apiKeyName || "", apiKeyValue: "" };
      onConfigChange({ ...config, auth: newAuth });
    }
  }, [detectedAuth]);

  // Handle server selection
  const handleServerChange = (value: string) => {
    if (value === "custom") {
      setUseCustomUrl(true);
      onConfigChange({ ...config, baseUrl: customUrl });
    } else {
      setUseCustomUrl(false);
      onConfigChange({ ...config, baseUrl: value });
    }
  };

  // Handle custom URL change
  const handleCustomUrlChange = (url: string) => {
    setCustomUrl(url);
    if (useCustomUrl) {
      onConfigChange({ ...config, baseUrl: url });
    }
  };

  // Handle auth type change
  const handleAuthTypeChange = (type: AuthType) => {
    setAuthType(type);
    updateAuthConfig(type, bearerToken, apiKeyName, apiKeyValue);
  };

  // Handle auth value changes
  const handleBearerChange = (token: string) => {
    setBearerToken(token);
    updateAuthConfig(authType, token, apiKeyName, apiKeyValue);
  };

  const handleApiKeyNameChange = (name: string) => {
    setApiKeyName(name);
    updateAuthConfig(authType, bearerToken, name, apiKeyValue);
  };

  const handleApiKeyValueChange = (value: string) => {
    setApiKeyValue(value);
    updateAuthConfig(authType, bearerToken, apiKeyName, value);
  };

  // Update auth config
  const updateAuthConfig = (
    type: AuthType,
    token: string,
    keyName: string,
    keyValue: string
  ) => {
    let auth: AuthConfig;
    switch (type) {
      case "bearer":
        auth = { type: "bearer", token };
        break;
      case "apikey-header":
        auth = { type: "apikey-header", apiKeyName: keyName, apiKeyValue: keyValue };
        break;
      case "apikey-query":
        auth = { type: "apikey-query", apiKeyName: keyName, apiKeyValue: keyValue };
        break;
      default:
        auth = { type: "none" };
    }
    onConfigChange({ ...config, auth });
  };

  const handleAutoAuthComplete = (accessToken: string, refreshToken: string | undefined, autoConfig: AutoAuthConfig) => {
    // Update bearer token
    setBearerToken(accessToken);
    updateAuthConfig("bearer", accessToken, apiKeyName, apiKeyValue);
    // Notify parent
    onAutoAuthComplete?.(accessToken, refreshToken, autoConfig);
  };

  const isConfigured = config.baseUrl && config.baseUrl.length > 0;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" />
              API Configuration
              {isConfigured && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Configured
                </Badge>
              )}
            </CardTitle>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Base URL */}
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Select
                value={useCustomUrl ? "custom" : config.baseUrl}
                onValueChange={handleServerChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a server..." />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((server: ServerType, i: number) => (
                    <SelectItem key={i} value={server.url}>
                      {server.url}
                      {server.description && (
                        <span className="text-muted-foreground ml-2">
                          ({server.description})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom URL...</SelectItem>
                </SelectContent>
              </Select>
              {useCustomUrl && (
                <Input
                  placeholder="https://api.example.com"
                  value={customUrl}
                  onChange={(e) => handleCustomUrlChange(e.target.value)}
                />
              )}
              {servers.length === 0 && !useCustomUrl && (
                <p className="text-xs text-muted-foreground">
                  No servers found in spec. Enter a custom URL.
                </p>
              )}
            </div>

            {/* Authentication */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Authentication
                {detectedAuth.length > 0 && (
                  <Badge variant="outline" className="text-xs font-normal">
                    <Info className="h-3 w-3 mr-1" />
                    Detected from spec
                  </Badge>
                )}
              </Label>

              {/* Show detected auth schemes */}
              {detectedAuth.length > 0 && (
                <div className="text-xs bg-muted/50 rounded-md p-2 space-y-2">
                  <span className="font-medium text-muted-foreground">API requires:</span>
                  <div className="flex flex-wrap gap-2">
                    {detectedAuth.map((auth, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setAuthType(auth.type);
                          if (auth.apiKeyName) {
                            setApiKeyName(auth.apiKeyName);
                          }
                          updateAuthConfig(
                            auth.type,
                            bearerToken,
                            auth.apiKeyName || apiKeyName,
                            apiKeyValue
                          );
                        }}
                        className={cn(
                          "px-2 py-1 rounded border text-xs transition-colors",
                          authType === auth.type
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        )}
                      >
                        <span className="font-mono">{auth.name}</span>
                        {auth.apiKeyName && (
                          <span className="ml-1 opacity-70">
                            ({auth.apiKeyName})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Select value={authType} onValueChange={(v) => handleAuthTypeChange(v as AuthType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{getAuthTypeLabel("none")}</SelectItem>
                  <SelectItem value="bearer">{getAuthTypeLabel("bearer")}</SelectItem>
                  <SelectItem value="apikey-header">{getAuthTypeLabel("apikey-header")}</SelectItem>
                  <SelectItem value="apikey-query">{getAuthTypeLabel("apikey-query")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Bearer token input */}
              {authType === "bearer" && (
                <div className="space-y-2">
                  {/* Auto Auth status */}
                  {autoAuthState?.status === "authenticated" && autoAuthState.config && (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          Auto-authenticated
                        </span>
                        <code className="bg-muted px-1 rounded text-muted-foreground">
                          {autoAuthState.config.loginEndpoint.path}
                        </code>
                        {autoAuthState.obtainedAt && (
                          <span className="text-muted-foreground ml-auto">
                            {formatTimeAgo(autoAuthState.obtainedAt)}
                          </span>
                        )}
                      </div>
                      {autoAuthState.config.autoRefresh && autoAuthState.config.refreshEndpoint && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <RefreshCw className="h-3 w-3" />
                          Auto-refresh enabled
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={() => onAutoAuthComplete && onAutoAuthComplete(
                            autoAuthState.accessToken!,
                            autoAuthState.refreshToken || undefined,
                            autoAuthState.config!
                          )}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Re-authenticate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={() => setAutoAuthOpen(true)}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1 text-red-600 dark:text-red-400"
                          onClick={onAutoAuthClear}
                        >
                          <X className="h-3 w-3" />
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}

                  <Input
                    type="password"
                    placeholder="Enter Bearer token..."
                    value={bearerToken}
                    onChange={(e) => {
                      handleBearerChange(e.target.value);
                      // If user manually edits token, clear auto-auth status
                      if (autoAuthState?.status === "authenticated" && onAutoAuthClear) {
                        onAutoAuthClear();
                      }
                    }}
                  />

                  {/* TODO: Auto Auth button - hidden until wizard UX is refined
                  {tagsInfo && tagsInfo.size > 0 && autoAuthState?.status !== "authenticated" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={() => setAutoAuthOpen(true)}
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      Auto Auth - Login with endpoint
                    </Button>
                  )}
                  */}
                </div>
              )}

              {/* API Key inputs */}
              {(authType === "apikey-header" || authType === "apikey-query") && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Key name (e.g., X-API-Key)"
                    value={apiKeyName}
                    onChange={(e) => handleApiKeyNameChange(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="Key value"
                    value={apiKeyValue}
                    onChange={(e) => handleApiKeyValueChange(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Status indicator */}
            {isConfigured && (
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Ready to test endpoints at{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{config.baseUrl}</code>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      {/* Auto Auth Dialog */}
      {tagsInfo && (
        <AutoAuthDialog
          swagger={swagger}
          tagsInfo={tagsInfo}
          baseUrl={config.baseUrl}
          open={autoAuthOpen}
          onOpenChange={setAutoAuthOpen}
          onAuthComplete={handleAutoAuthComplete}
          existingConfig={autoAuthState?.config}
        />
      )}
    </Card>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
