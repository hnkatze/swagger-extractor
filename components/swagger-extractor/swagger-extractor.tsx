"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { RotateCcw, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileUpload } from "./file-upload";
import { ApiInfoCard } from "./api-info-card";
import { TagsTable } from "./tags-table";
import { EndpointsPreview } from "./endpoints-preview";
import { ExportPanel } from "./export-panel";
import { ApiConfig, ApiConfigState } from "@/components/api-tester/api-config";
import { analyzeTags } from "@/lib/swagger/analyzer";
import { extractByTags } from "@/lib/swagger/extractor";
import type { SwaggerDocument, TagInfo, ExtractionResult } from "@/lib/types/swagger";
import {
  type AutoAuthState,
  type AutoAuthConfig,
  INITIAL_AUTO_AUTH_STATE,
  saveAutoAuthConfig,
  loadAutoAuthConfig,
  clearAutoAuthConfig,
  executeAutoRefresh,
  executeAutoLogin,
} from "@/lib/api-testing/auto-auth";

const REFRESH_INTERVAL_MS = 25 * 60 * 1000; // 25 minutes

export function SwaggerExtractor() {
  const [swagger, setSwagger] = useState<SwaggerDocument | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [tagsInfo, setTagsInfo] = useState<Map<string, TagInfo>>(new Map());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // API testing configuration (global)
  const [apiConfig, setApiConfig] = useState<ApiConfigState>({
    baseUrl: "",
    auth: { type: "none" },
  });

  // Auto Auth state
  const [autoAuthState, setAutoAuthState] = useState<AutoAuthState>(INITIAL_AUTO_AUTH_STATE);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore auto-auth config from localStorage on swagger load
  useEffect(() => {
    if (!swagger) return;
    const saved = loadAutoAuthConfig(swagger.info.title, swagger.info.version || "1.0");
    if (saved) {
      setAutoAuthState((prev) => ({ ...prev, config: saved }));
      toast.info("Previous auto-auth config found. Use Auto Auth to re-authenticate.");
    }
  }, [swagger]);

  // Auto-refresh timer
  useEffect(() => {
    // Clean up previous interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (
      autoAuthState.status !== "authenticated" ||
      !autoAuthState.config?.autoRefresh ||
      !autoAuthState.config?.refreshEndpoint ||
      !autoAuthState.refreshToken ||
      !apiConfig.baseUrl
    ) {
      return;
    }

    refreshIntervalRef.current = setInterval(async () => {
      if (!autoAuthState.config || !autoAuthState.refreshToken) return;

      setAutoAuthState((prev) => ({ ...prev, status: "refreshing" }));

      const result = await executeAutoRefresh(
        apiConfig.baseUrl,
        autoAuthState.config,
        autoAuthState.refreshToken
      );

      if (result.ok) {
        setAutoAuthState((prev) => ({
          ...prev,
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken ?? prev.refreshToken,
          obtainedAt: Date.now(),
          status: "authenticated",
        }));
        setApiConfig((prev) => ({
          ...prev,
          auth: { ...prev.auth, token: result.data.accessToken, autoAuth: true },
        }));
        toast.success("Token auto-refreshed");
      } else {
        setAutoAuthState((prev) => ({
          ...prev,
          status: "error",
          error: result.error,
        }));
        toast.error("Token refresh failed. Please re-authenticate.");
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [
    autoAuthState.status,
    autoAuthState.config?.autoRefresh,
    autoAuthState.config?.refreshEndpoint,
    autoAuthState.refreshToken,
    apiConfig.baseUrl,
  ]);

  const handleAutoAuthComplete = useCallback(
    (accessToken: string, refreshToken: string | undefined, config: AutoAuthConfig) => {
      setAutoAuthState({
        config,
        accessToken,
        refreshToken: refreshToken ?? null,
        obtainedAt: Date.now(),
        status: "authenticated",
      });
      setApiConfig((prev) => ({
        ...prev,
        auth: { type: "bearer", token: accessToken, autoAuth: true },
      }));
      // Persist config
      if (swagger) {
        saveAutoAuthConfig(swagger.info.title, swagger.info.version || "1.0", config);
      }
      toast.success("Auto-authenticated successfully!");
    },
    [swagger]
  );

  const handleAutoAuthClear = useCallback(() => {
    setAutoAuthState(INITIAL_AUTO_AUTH_STATE);
    if (swagger) {
      clearAutoAuthConfig(swagger.info.title, swagger.info.version || "1.0");
    }
  }, [swagger]);

  const handleFileLoaded = useCallback((doc: SwaggerDocument, name: string) => {
    setSwagger(doc);
    setFilename(name);
    const tags = analyzeTags(doc);
    setTagsInfo(tags);
    setSelectedTags(new Set());
    // Reset API config and auto-auth when loading new file
    setApiConfig({ baseUrl: "", auth: { type: "none" } });
    setAutoAuthState(INITIAL_AUTO_AUTH_STATE);
    toast.success(`Loaded ${name} - Found ${tags.size} tags`);
  }, []);

  const handleError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  const handleReset = useCallback(() => {
    setSwagger(null);
    setFilename("");
    setTagsInfo(new Map());
    setSelectedTags(new Set());
    setApiConfig({ baseUrl: "", auth: { type: "none" } });
    setAutoAuthState(INITIAL_AUTO_AUTH_STATE);
  }, []);

  const extractionResult = useMemo<ExtractionResult | null>(() => {
    if (!swagger || selectedTags.size === 0) return null;
    return extractByTags(swagger, Array.from(selectedTags), tagsInfo);
  }, [swagger, selectedTags, tagsInfo]);

  // Initial state - show file upload
  if (!swagger) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <FileUpload onFileLoaded={handleFileLoaded} onError={handleError} />
      </div>
    );
  }

  // Swagger loaded - show full interface
  return (
    <div className="w-full space-y-6">
      {/* Header with reset button and help */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Swagger Analysis</h2>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                Help
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>How to use Swagger Extractor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <section>
                  <h3 className="font-semibold mb-1">1. Select Tags</h3>
                  <p className="text-muted-foreground">
                    Use the checkboxes in the Tags table to select which API groups
                    you want to extract. You can search and filter by HTTP method.
                  </p>
                </section>
                <section>
                  <h3 className="font-semibold mb-1">2. Configure API (Optional)</h3>
                  <p className="text-muted-foreground">
                    If you want to test endpoints, configure the Base URL and Authentication
                    in the API Configuration panel. The app auto-detects security schemes from your spec.
                  </p>
                </section>
                <section>
                  <h3 className="font-semibold mb-1">3. Preview & Test</h3>
                  <p className="text-muted-foreground">
                    Click on any endpoint to view details. Use the &quot;Test&quot; button to send
                    actual requests. Supports path params, query params, JSON body, and file uploads.
                  </p>
                </section>
                <section>
                  <h3 className="font-semibold mb-1">4. Export</h3>
                  <p className="text-muted-foreground">
                    Export selected tags in JSON or TOON format. TOON is optimized for LLM prompts,
                    using ~40% fewer tokens than JSON.
                  </p>
                </section>
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <p><strong>Supported:</strong> OpenAPI 3.x, Swagger 2.0</p>
                  <p><strong>Auth types:</strong> Bearer Token, API Key (header/query), Auto Auth</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Load Different File
          </Button>
        </div>
      </div>

      {/* API Info */}
      <ApiInfoCard swagger={swagger} tagsInfo={tagsInfo} filename={filename} />

      {/* API Configuration for testing */}
      <ApiConfig
        swagger={swagger}
        config={apiConfig}
        onConfigChange={setApiConfig}
        tagsInfo={tagsInfo}
        autoAuthState={autoAuthState}
        onAutoAuthComplete={handleAutoAuthComplete}
        onAutoAuthClear={handleAutoAuthClear}
      />

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column - Tag selection */}
        <div className="space-y-6">
          <TagsTable
            tagsInfo={tagsInfo}
            selectedTags={selectedTags}
            onSelectionChange={setSelectedTags}
          />
        </div>

        {/* Right column - Preview and Export */}
        <div className="space-y-6">
          <EndpointsPreview
            tagsInfo={tagsInfo}
            selectedTags={selectedTags}
            swagger={swagger}
            apiConfig={apiConfig}
          />
          <ExportPanel result={extractionResult} />
        </div>
      </div>
    </div>
  );
}
