"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Play, Loader2, Clock, AlertCircle, Settings, Upload, X, FileIcon, Copy, Check } from "lucide-react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { EndpointInfo } from "@/lib/types/swagger";
import type { ApiConfigState } from "./api-config";
import {
  executeRequest,
  extractPathParamNames,
  getStatusColor,
  formatResponseBody,
  ExecutionResult,
} from "@/lib/api-testing/request-executor";
import type { ProxyResponse } from "@/app/api/proxy/route";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500 text-white",
  POST: "bg-blue-500 text-white",
  PUT: "bg-amber-500 text-white",
  PATCH: "bg-orange-500 text-white",
  DELETE: "bg-red-500 text-white",
};

interface ApiTesterProps {
  endpoint: EndpointInfo | null;
  config: ApiConfigState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper to check if endpoint expects file upload
function isFileUpload(contentType?: string): boolean {
  if (!contentType) return false;
  return (
    contentType === "multipart/form-data" ||
    contentType === "application/octet-stream" ||
    contentType.startsWith("image/") ||
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/")
  );
}

export function ApiTester({
  endpoint,
  config,
  open,
  onOpenChange,
}: ApiTesterProps) {
  // Request state
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Response state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [headersOpen, setHeadersOpen] = useState(false);

  // Check if this endpoint expects a file upload
  const expectsFileUpload = useMemo(() => {
    return isFileUpload(endpoint?.bodyContentType);
  }, [endpoint?.bodyContentType]);

  // Pre-populate request body with example when dialog opens
  useEffect(() => {
    if (open && endpoint?.bodyExample && !expectsFileUpload) {
      const exampleStr = typeof endpoint.bodyExample === "string"
        ? endpoint.bodyExample
        : JSON.stringify(endpoint.bodyExample, null, 2);
      setRequestBody(exampleStr);
    }
  }, [open, endpoint?.bodyExample, expectsFileUpload]);

  // Get path parameter names
  const pathParamNames = useMemo(() => {
    if (!endpoint) return [];
    return extractPathParamNames(endpoint.path);
  }, [endpoint]);

  // Parse endpoint params to get query params
  const queryParamNames = useMemo(() => {
    if (!endpoint?.params) return [];
    return endpoint.params
      .filter((p) => p.includes("(query)"))
      .map((p) => p.replace("*", "").replace("(query)", ""));
  }, [endpoint]);

  // Check if config is ready
  const isConfigured = config.baseUrl && config.baseUrl.length > 0;

  // Execute the request
  const handleExecute = async () => {
    if (!endpoint || !isConfigured) return;

    setLoading(true);
    setResult(null);

    const executionResult = await executeRequest({
      baseUrl: config.baseUrl,
      path: endpoint.path,
      method: endpoint.method,
      pathParams,
      queryParams,
      body: expectsFileUpload ? undefined : (requestBody || undefined),
      file: expectsFileUpload ? (selectedFile || undefined) : undefined,
      contentType: endpoint.bodyContentType,
      auth: config.auth,
    });

    setResult(executionResult);
    setLoading(false);
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setResult(null);
      setPathParams({});
      setQueryParams({});
      setRequestBody("");
      setSelectedFile(null);
    }
    onOpenChange(newOpen);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Clear selected file
  const handleFileClear = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (!endpoint) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Badge
              className={cn(
                "font-mono text-xs",
                METHOD_COLORS[endpoint.method] || "bg-gray-500"
              )}
            >
              {endpoint.method}
            </Badge>
            <code className="font-mono text-sm break-all">{endpoint.path}</code>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 min-h-0">
          <div className="space-y-4 pb-4 overflow-hidden">
            {/* Not configured warning */}
            {!isConfigured && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm font-medium">Configuration Required</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Configure the Base URL in the API Configuration panel before testing.
                </p>
              </div>
            )}

            {/* Current config summary */}
            {isConfigured && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                <span className="font-medium">Target:</span>{" "}
                <code>{config.baseUrl}</code>
                {config.auth.type !== "none" && (
                  <>
                    {" | "}
                    <span className="font-medium">Auth:</span>{" "}
                    {config.auth.type === "bearer" && "Bearer Token"}
                    {config.auth.type === "apikey-header" && `Header: ${config.auth.apiKeyName}`}
                    {config.auth.type === "apikey-query" && `Query: ${config.auth.apiKeyName}`}
                  </>
                )}
              </div>
            )}

            {/* Parameters Section */}
            {(pathParamNames.length > 0 || queryParamNames.length > 0) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Parameters</h3>

                {/* Path Parameters */}
                {pathParamNames.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Path Parameters
                    </Label>
                    <div className="grid gap-2">
                      {pathParamNames.map((name) => (
                        <div key={name} className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded min-w-[80px]">
                            {"{" + name + "}"}
                          </code>
                          <Input
                            placeholder={`Enter ${name}...`}
                            value={pathParams[name] || ""}
                            onChange={(e) =>
                              setPathParams((prev) => ({
                                ...prev,
                                [name]: e.target.value,
                              }))
                            }
                            className="flex-1 h-8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Query Parameters */}
                {queryParamNames.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Query Parameters
                    </Label>
                    <div className="grid gap-2">
                      {queryParamNames.map((name) => (
                        <div key={name} className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded min-w-[80px]">
                            {name}
                          </code>
                          <Input
                            placeholder={`Enter ${name}...`}
                            value={queryParams[name] || ""}
                            onChange={(e) =>
                              setQueryParams((prev) => ({
                                ...prev,
                                [name]: e.target.value,
                              }))
                            }
                            className="flex-1 h-8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Request Body */}
            {["POST", "PUT", "PATCH"].includes(endpoint.method) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Request Body
                  {endpoint.body && (
                    <Badge variant="outline" className="text-xs">
                      {endpoint.body}
                    </Badge>
                  )}
                  {endpoint.bodyContentType && (
                    <Badge variant="secondary" className="text-xs">
                      {endpoint.bodyContentType}
                    </Badge>
                  )}
                </Label>

                {/* File Upload UI */}
                {expectsFileUpload ? (
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {selectedFile ? (
                      <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || "unknown type"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleFileClear}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-6 border-2 border-dashed rounded-md hover:border-primary/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="h-8 w-8" />
                          <span className="text-sm font-medium">Click to select file</span>
                          <span className="text-xs">or drag and drop</span>
                        </div>
                      </button>
                    )}
                  </div>
                ) : (
                  <Textarea
                    placeholder={endpoint.bodyExample ? "Example loaded from spec" : '{ "key": "value" }'}
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    className="h-[100px] font-mono text-sm resize-none"
                  />
                )}
              </div>
            )}

            {/* Execute Button */}
            <Button
              onClick={handleExecute}
              disabled={loading || !isConfigured}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Send Request
                </>
              )}
            </Button>

            {/* Response Section */}
            {result && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Response</h3>

                {result.success && result.response ? (
                  <ResponseDisplay
                    response={result.response}
                    headersOpen={headersOpen}
                    setHeadersOpen={setHeadersOpen}
                  />
                ) : (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">Request Failed</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {result.error}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Response display component
function ResponseDisplay({
  response,
  headersOpen,
  setHeadersOpen,
}: {
  response: ProxyResponse;
  headersOpen: boolean;
  setHeadersOpen: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const formattedBody = formatResponseBody(
    response.body,
    response.headers["content-type"]
  );

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(formattedBody || response.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fail
    }
  };

  return (
    <div className="space-y-2">
      {/* Status line */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge
          variant="outline"
          className={cn("font-mono", getStatusColor(response.status))}
        >
          {response.status} {response.statusText}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {response.duration}ms
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 ml-auto gap-1"
          onClick={copyResponse}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span className="text-xs">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </Button>
      </div>

      {/* Headers (collapsible) */}
      <Collapsible open={headersOpen} onOpenChange={setHeadersOpen}>
        <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground">
          {headersOpen ? "Hide" : "Show"} Headers (
          {Object.keys(response.headers).length})
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-md border bg-muted/30 p-2 overflow-auto">
            <div className="text-xs font-mono">
              {Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="break-all">
                  <span className="text-blue-600 dark:text-blue-400">{key}</span>
                  <span className="text-muted-foreground">: </span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Body */}
      <div className="rounded-md border bg-muted/30 max-h-[250px] overflow-auto">
        <pre className="p-2 text-xs font-mono whitespace-pre-wrap break-all">
          {formattedBody || "(empty response)"}
        </pre>
      </div>
    </div>
  );
}
