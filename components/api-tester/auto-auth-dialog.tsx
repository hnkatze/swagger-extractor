"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  LogIn,
  RefreshCw,
  Check,
  Loader2,
  X,
  AlertTriangle,
  SkipForward,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SwaggerDocument, TagInfo, EndpointInfo } from "@/lib/types/swagger";
import { getSchemas } from "@/lib/swagger/parser";
import { resolveSchemaDeep } from "@/lib/swagger/schema-simplifier";
import type { DeepSchemaField } from "@/lib/swagger/schema-simplifier";
import {
  type AutoAuthConfig,
  type AutoAuthEndpointConfig,
  type FieldMapping,
  flattenSchemaToFieldPaths,
  flattenSchemaToFormFields,
  getInputType,
  rankAuthEndpoints,
  rankRefreshEndpoints,
  rankTokenFields,
  rankRefreshFields,
  executeAutoLogin,
} from "@/lib/api-testing/auto-auth";

interface AutoAuthDialogProps {
  swagger: SwaggerDocument;
  tagsInfo: Map<string, TagInfo>;
  baseUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthComplete: (accessToken: string, refreshToken: string | undefined, config: AutoAuthConfig) => void;
  existingConfig?: AutoAuthConfig | null;
}

type WizardStep = "login-endpoint" | "credentials" | "token-mapping" | "refresh-endpoint" | "test";

const STEPS: WizardStep[] = ["login-endpoint", "credentials", "token-mapping", "refresh-endpoint", "test"];

const STEP_LABELS: Record<WizardStep, string> = {
  "login-endpoint": "Login Endpoint",
  "credentials": "Credentials",
  "token-mapping": "Token Mapping",
  "refresh-endpoint": "Refresh (Optional)",
  "test": "Test & Apply",
};

interface EndpointWithTag extends EndpointInfo {
  tag: string;
}

function getAllPostEndpoints(tagsInfo: Map<string, TagInfo>): EndpointWithTag[] {
  const endpoints: EndpointWithTag[] = [];
  for (const [tag, info] of tagsInfo) {
    for (const ep of info.paths) {
      if (ep.method === "POST") {
        endpoints.push({ ...ep, tag });
      }
    }
  }
  return endpoints;
}

export function AutoAuthDialog({
  swagger,
  tagsInfo,
  baseUrl,
  open,
  onOpenChange,
  onAuthComplete,
  existingConfig,
}: AutoAuthDialogProps) {
  const [step, setStep] = useState<WizardStep>("login-endpoint");
  const [search, setSearch] = useState("");

  // Step 1: Login endpoint
  const [loginEndpoint, setLoginEndpoint] = useState<EndpointWithTag | null>(null);

  // Step 2: Credentials
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJson, setRawJson] = useState("");

  // Step 3: Token mapping
  const [tokenFieldPath, setTokenFieldPath] = useState("");
  const [refreshTokenFieldPath, setRefreshTokenFieldPath] = useState("");
  const [customTokenPath, setCustomTokenPath] = useState("");
  const [useCustomTokenPath, setUseCustomTokenPath] = useState(false);

  // Step 4: Refresh endpoint
  const [refreshEndpoint, setRefreshEndpoint] = useState<EndpointWithTag | null>(null);
  const [refreshBodyFieldPath, setRefreshBodyFieldPath] = useState("refreshToken");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Step 5: Test
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<string>("");
  const [testToken, setTestToken] = useState<string>("");
  const [testRefreshToken, setTestRefreshToken] = useState<string>("");

  const allSchemas = useMemo(() => getSchemas(swagger), [swagger]);

  // Restore existing config on open
  useMemo(() => {
    if (existingConfig && open) {
      // Try to find the endpoints in tagsInfo
      const allPost = getAllPostEndpoints(tagsInfo);
      const loginEp = allPost.find(
        (ep) => ep.path === existingConfig.loginEndpoint.path && ep.method === existingConfig.loginEndpoint.method
      );
      if (loginEp) setLoginEndpoint(loginEp);
      setCredentials(existingConfig.credentials);
      setTokenFieldPath(existingConfig.tokenFieldPath);
      setRefreshTokenFieldPath(existingConfig.refreshTokenFieldPath || "");
      setRefreshBodyFieldPath(existingConfig.refreshBodyFieldPath || "refreshToken");
      setAutoRefresh(existingConfig.autoRefresh);
      if (existingConfig.refreshEndpoint) {
        const refreshEp = allPost.find(
          (ep) => ep.path === existingConfig.refreshEndpoint!.path
        );
        if (refreshEp) setRefreshEndpoint(refreshEp);
      }
    }
  }, [existingConfig, open, tagsInfo]);

  // --- Computed values ---

  const postEndpoints = useMemo(() => {
    const all = getAllPostEndpoints(tagsInfo);
    return rankAuthEndpoints(all);
  }, [tagsInfo]);

  const refreshEndpoints = useMemo(() => {
    const all = getAllPostEndpoints(tagsInfo);
    return rankRefreshEndpoints(all);
  }, [tagsInfo]);

  const filteredEndpoints = useMemo(() => {
    const list = step === "refresh-endpoint" ? refreshEndpoints : postEndpoints;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (ep) =>
        ep.path.toLowerCase().includes(q) ||
        ep.summary?.toLowerCase().includes(q) ||
        ep.tag.toLowerCase().includes(q)
    );
  }, [postEndpoints, refreshEndpoints, search, step]);

  // Login endpoint body schema fields (for credential form)
  const loginBodyFields = useMemo(() => {
    if (!loginEndpoint?.body) return null;
    const deep = resolveSchemaDeep(loginEndpoint.body, allSchemas as Record<string, Record<string, unknown>>);
    if (!deep) return null;
    return flattenSchemaToFormFields(deep);
  }, [loginEndpoint, allSchemas]);

  // Login endpoint response field paths (for token mapping)
  const responseFieldPaths = useMemo(() => {
    if (!loginEndpoint?.response) return [];
    const deep = resolveSchemaDeep(loginEndpoint.response, allSchemas as Record<string, Record<string, unknown>>);
    if (!deep) return [];
    return flattenSchemaToFieldPaths(deep);
  }, [loginEndpoint, allSchemas]);

  const rankedTokenPaths = useMemo(() => rankTokenFields(responseFieldPaths), [responseFieldPaths]);
  const rankedRefreshPaths = useMemo(() => rankRefreshFields(responseFieldPaths), [responseFieldPaths]);

  // Auto-select best token field when paths change
  useMemo(() => {
    if (rankedTokenPaths.length > 0 && !tokenFieldPath) {
      setTokenFieldPath(rankedTokenPaths[0].fieldPath);
    }
  }, [rankedTokenPaths, tokenFieldPath]);

  // --- Navigation ---

  const currentStepIndex = STEPS.indexOf(step);

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setStep(STEPS[currentStepIndex + 1]);
      setSearch("");
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setStep(STEPS[currentStepIndex - 1]);
      setSearch("");
    }
  };

  const canGoNext = (): boolean => {
    switch (step) {
      case "login-endpoint":
        return loginEndpoint !== null;
      case "credentials":
        if (rawJsonMode) return rawJson.trim().length > 0;
        return Object.values(credentials).some((v) => v.length > 0);
      case "token-mapping":
        return (useCustomTokenPath ? customTokenPath.trim() : tokenFieldPath).length > 0;
      case "refresh-endpoint":
        return true; // optional step
      case "test":
        return testStatus === "success";
      default:
        return false;
    }
  };

  // --- Build config ---

  const buildConfig = (): AutoAuthConfig => {
    const loginEpConfig: AutoAuthEndpointConfig = {
      path: loginEndpoint!.path,
      method: loginEndpoint!.method,
      summary: loginEndpoint!.summary,
      bodySchema: loginEndpoint!.body,
      responseSchema: loginEndpoint!.response,
    };

    let creds: Record<string, string>;
    if (rawJsonMode) {
      try {
        creds = JSON.parse(rawJson);
      } catch {
        creds = credentials;
      }
    } else {
      creds = credentials;
    }

    const refreshEpConfig: AutoAuthEndpointConfig | undefined = refreshEndpoint
      ? {
          path: refreshEndpoint.path,
          method: refreshEndpoint.method,
          summary: refreshEndpoint.summary,
          bodySchema: refreshEndpoint.body,
          responseSchema: refreshEndpoint.response,
        }
      : undefined;

    return {
      loginEndpoint: loginEpConfig,
      refreshEndpoint: refreshEpConfig,
      credentials: creds,
      tokenFieldPath: useCustomTokenPath ? customTokenPath : tokenFieldPath,
      refreshTokenFieldPath: refreshTokenFieldPath || undefined,
      refreshBodyFieldPath: refreshBodyFieldPath || undefined,
      autoRefresh: autoRefresh && !!refreshEpConfig,
    };
  };

  // --- Test login ---

  const handleTestLogin = async () => {
    setTestStatus("loading");
    setTestResult("");
    setTestToken("");
    setTestRefreshToken("");

    const config = buildConfig();
    const result = await executeAutoLogin(baseUrl, config);

    if (result.ok) {
      setTestStatus("success");
      setTestToken(result.data.accessToken);
      setTestRefreshToken(result.data.refreshToken || "");
      setTestResult("Login successful! Token extracted.");
    } else {
      setTestStatus("error");
      setTestResult(result.error);
    }
  };

  const handleApply = () => {
    const config = buildConfig();
    onAuthComplete(testToken, testRefreshToken || undefined, config);
    onOpenChange(false);
    // Reset wizard
    setStep("login-endpoint");
    setTestStatus("idle");
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("login-endpoint");
    setSearch("");
    setTestStatus("idle");
  };

  // --- Render endpoint list ---

  const renderEndpointList = (
    endpoints: EndpointWithTag[],
    selected: EndpointWithTag | null,
    onSelect: (ep: EndpointWithTag) => void
  ) => (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search endpoints..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <ScrollArea className="h-[280px]">
        <div className="space-y-1 pr-2">
          {endpoints.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No POST endpoints found
            </p>
          )}
          {endpoints.map((ep, i) => (
            <button
              key={`${ep.path}-${i}`}
              type="button"
              onClick={() => onSelect(ep)}
              className={cn(
                "w-full text-left rounded-md border p-2.5 text-sm transition-colors",
                selected?.path === ep.path
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500 text-white text-xs shrink-0">POST</Badge>
                <code className="font-mono text-xs break-all">{ep.path}</code>
              </div>
              {ep.summary && (
                <p className="text-xs text-muted-foreground mt-1 pl-1">{ep.summary}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{ep.tag}</Badge>
                {ep.body && (
                  <Badge variant="outline" className="text-xs text-blue-600 dark:text-blue-400">
                    body: {ep.body}
                  </Badge>
                )}
                {ep.response && (
                  <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400">
                    res: {ep.response}
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  // --- Step renderers ---

  const renderStep = () => {
    switch (step) {
      case "login-endpoint":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select the endpoint that handles authentication (login/signin).
            </p>
            {renderEndpointList(filteredEndpoints, loginEndpoint, (ep) => {
              setLoginEndpoint(ep);
              // Reset dependent state
              setCredentials({});
              setTokenFieldPath("");
              setRefreshTokenFieldPath("");
              setRawJson("");
              setUseCustomTokenPath(false);
            })}
          </div>
        );

      case "credentials":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the credentials for{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">{loginEndpoint?.path}</code>
            </p>

            {loginBodyFields && !rawJsonMode ? (
              <div className="space-y-3">
                {loginBodyFields.map((field) => (
                  <div key={field.name} className="space-y-1">
                    <Label className="text-xs flex items-center gap-2">
                      {field.name}
                      <span className="text-muted-foreground font-normal">({field.type})</span>
                    </Label>
                    <Input
                      type={getInputType(field.name)}
                      placeholder={`Enter ${field.name}...`}
                      value={credentials[field.name] || ""}
                      onChange={(e) =>
                        setCredentials((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => {
                    setRawJsonMode(true);
                    setRawJson(JSON.stringify(credentials, null, 2));
                  }}
                >
                  Switch to raw JSON
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Request Body (JSON)</Label>
                <Textarea
                  rows={8}
                  placeholder='{"email": "admin@test.com", "password": "..."}'
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  className="font-mono text-xs"
                />
                {loginBodyFields && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => setRawJsonMode(false)}
                  >
                    Switch to form fields
                  </button>
                )}
              </div>
            )}

            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Credentials are saved locally for convenience. Use test/development credentials only.
              </p>
            </div>
          </div>
        );

      case "token-mapping":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map which response fields contain the tokens.
            </p>

            {/* Access token */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Access Token Field *</Label>
              {rankedTokenPaths.length > 0 && !useCustomTokenPath ? (
                <>
                  <Select value={tokenFieldPath} onValueChange={setTokenFieldPath}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select token field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rankedTokenPaths.map((f) => (
                        <SelectItem key={f.fieldPath} value={f.fieldPath}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => setUseCustomTokenPath(true)}
                  >
                    Enter path manually
                  </button>
                </>
              ) : (
                <>
                  <Input
                    placeholder="e.g., data.accessToken"
                    value={customTokenPath}
                    onChange={(e) => setCustomTokenPath(e.target.value)}
                    className="font-mono text-xs"
                  />
                  {rankedTokenPaths.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                      onClick={() => setUseCustomTokenPath(false)}
                    >
                      Select from schema
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Refresh token */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Refresh Token Field <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              {rankedRefreshPaths.length > 0 ? (
                <Select
                  value={refreshTokenFieldPath || "__none__"}
                  onValueChange={(v) => setRefreshTokenFieldPath(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select refresh token field..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {rankedRefreshPaths.map((f) => (
                      <SelectItem key={f.fieldPath} value={f.fieldPath}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="e.g., data.refreshToken (leave empty to skip)"
                  value={refreshTokenFieldPath}
                  onChange={(e) => setRefreshTokenFieldPath(e.target.value)}
                  className="font-mono text-xs"
                />
              )}
            </div>

            {loginEndpoint?.response && responseFieldPaths.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No string fields found in response schema. Enter the path manually above, or use &quot;Test &amp; Discover&quot; in the next step.
              </p>
            )}
          </div>
        );

      case "refresh-endpoint":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Optionally select a refresh token endpoint.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => {
                  setRefreshEndpoint(null);
                  goNext();
                }}
              >
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </Button>
            </div>

            {renderEndpointList(filteredEndpoints, refreshEndpoint, setRefreshEndpoint)}

            {refreshEndpoint && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs">
                  Refresh body field name
                  <span className="text-muted-foreground font-normal ml-1">
                    (the field that receives the refresh token)
                  </span>
                </Label>
                <Input
                  placeholder="refreshToken"
                  value={refreshBodyFieldPath}
                  onChange={(e) => setRefreshBodyFieldPath(e.target.value)}
                  className="font-mono text-xs"
                />
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded"
                  />
                  Auto-refresh token periodically
                </label>
              </div>
            )}
          </div>
        );

      case "test":
        return (
          <div className="space-y-4">
            {/* Config summary */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <LogIn className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-medium">Login:</span>
                <code className="bg-muted px-1 rounded">{loginEndpoint?.path}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium ml-5">Token path:</span>
                <code className="bg-muted px-1 rounded">
                  {useCustomTokenPath ? customTokenPath : tokenFieldPath}
                </code>
              </div>
              {refreshEndpoint && (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-medium">Refresh:</span>
                  <code className="bg-muted px-1 rounded">{refreshEndpoint.path}</code>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-medium ml-5">Base URL:</span>
                <code className="bg-muted px-1 rounded">{baseUrl || "(not set)"}</code>
              </div>
            </div>

            {/* Test button */}
            <Button
              onClick={handleTestLogin}
              disabled={testStatus === "loading" || !baseUrl}
              className="w-full gap-2"
            >
              {testStatus === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing login...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Test Login
                </>
              )}
            </Button>

            {!baseUrl && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Configure a Base URL in API Configuration before testing.
              </p>
            )}

            {/* Result */}
            {testStatus === "success" && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                  <Check className="h-4 w-4" />
                  {testResult}
                </div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="font-medium">Token:</span>{" "}
                    <code className="bg-muted px-1 rounded">
                      {testToken.slice(0, 20)}...{testToken.slice(-10)}
                    </code>
                  </div>
                  {testRefreshToken && (
                    <div>
                      <span className="font-medium">Refresh:</span>{" "}
                      <code className="bg-muted px-1 rounded">
                        {testRefreshToken.slice(0, 15)}...
                      </code>
                    </div>
                  )}
                </div>
              </div>
            )}

            {testStatus === "error" && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium">
                  <X className="h-4 w-4" />
                  Login failed
                </div>
                <p className="text-xs text-muted-foreground break-all">{testResult}</p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Auto Auth Setup
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 pt-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-colors flex-1",
                    i <= currentStepIndex ? "bg-primary" : "bg-muted"
                  )}
                  style={{ width: `${100 / STEPS.length}%` }}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Step {currentStepIndex + 1} of {STEPS.length}: {STEP_LABELS[step]}
          </p>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 flex-1 pr-1">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-3 border-t shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            disabled={currentStepIndex === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {step === "test" && testStatus === "success" ? (
            <Button size="sm" onClick={handleApply} className="gap-1">
              <Check className="h-4 w-4" />
              Save & Apply
            </Button>
          ) : step === "test" ? (
            <div />
          ) : (
            <Button
              size="sm"
              onClick={goNext}
              disabled={!canGoNext()}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
