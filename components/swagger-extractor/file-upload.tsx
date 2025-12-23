"use client";

import { useCallback, useState } from "react";
import { Upload, FileJson, ClipboardPaste, Link, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseSwagger } from "@/lib/swagger/parser";
import type { SwaggerDocument } from "@/lib/types/swagger";
import type { SwaggerProxyResponse } from "@/app/api/proxy/swagger/route";

interface FileUploadProps {
  onFileLoaded: (swagger: SwaggerDocument, filename: string) => void;
  onError: (error: string) => void;
}

export function FileUpload({ onFileLoaded, onError }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const processContent = useCallback(
    (content: string, filename: string) => {
      const result = parseSwagger(content);
      if (result.success && result.data) {
        onFileLoaded(result.data, filename);
      } else {
        onError(result.error || "Failed to parse swagger file");
      }
    },
    [onFileLoaded, onError]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".json")) {
        onError("Please upload a .json file");
        return;
      }

      try {
        const text = await file.text();
        processContent(text, file.name);
      } catch {
        onError("Failed to read file");
      }
    },
    [onError, processContent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handlePasteSubmit = useCallback(() => {
    if (!jsonText.trim()) {
      onError("Please paste your swagger JSON");
      return;
    }
    processContent(jsonText, "pasted-swagger.json");
  }, [jsonText, onError, processContent]);

  const handleUrlFetch = useCallback(async () => {
    if (!urlInput.trim()) {
      onError("Please enter a URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(urlInput);
    } catch {
      onError("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/proxy/swagger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });

      const result = (await response.json()) as SwaggerProxyResponse;

      if (result.success && result.data) {
        // Parse the fetched swagger
        const jsonString = JSON.stringify(result.data);
        const filename = urlInput.split("/").pop() || "swagger.json";
        processContent(jsonString, filename);
      } else {
        onError(result.error || "Failed to fetch swagger spec");
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to fetch swagger spec");
    } finally {
      setIsLoading(false);
    }
  }, [urlInput, onError, processContent]);

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="upload" className="gap-2">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Upload</span>
        </TabsTrigger>
        <TabsTrigger value="paste" className="gap-2">
          <ClipboardPaste className="h-4 w-4" />
          <span className="hidden sm:inline">Paste</span>
        </TabsTrigger>
        <TabsTrigger value="url" className="gap-2">
          <Link className="h-4 w-4" />
          <span className="hidden sm:inline">URL</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-4 space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FileJson className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">
              Drop your swagger.json here
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
          </div>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleInputChange}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>

        {/* Supported formats info */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p className="font-medium">Supported formats:</p>
          <p>OpenAPI 3.x • Swagger 2.0 • JSON only</p>
        </div>
      </TabsContent>

      <TabsContent value="paste" className="mt-4 space-y-4">
        <Textarea
          placeholder='Paste your swagger.json content here...&#10;&#10;{&#10;  "openapi": "3.0.0",&#10;  "info": { ... },&#10;  "paths": { ... }&#10;}'
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="h-[300px] resize-none font-mono text-sm"
        />
        <Button onClick={handlePasteSubmit} className="w-full gap-2">
          <FileJson className="h-4 w-4" />
          Parse Swagger
        </Button>
      </TabsContent>

      <TabsContent value="url" className="mt-4 space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              type="url"
              placeholder="https://api.example.com/swagger.json"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleUrlFetch()}
              className="font-mono text-sm"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Enter a direct URL to a swagger.json or openapi.json file
            </p>
          </div>

          <Button
            onClick={handleUrlFetch}
            disabled={isLoading || !urlInput.trim()}
            className="w-full gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Link className="h-4 w-4" />
                Fetch Swagger
              </>
            )}
          </Button>
        </div>

        {/* URL examples */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Example URLs:</p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setUrlInput("https://petstore.swagger.io/v2/swagger.json")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline block text-left"
            >
              Petstore API (Swagger 2.0)
            </button>
            <button
              type="button"
              onClick={() => setUrlInput("https://petstore3.swagger.io/api/v3/openapi.json")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline block text-left"
            >
              Petstore API (OpenAPI 3.0)
            </button>
          </div>
        </div>

        {/* Note about CORS */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p className="font-medium">Works with:</p>
          <p>Public APIs • localhost URLs • CORS-enabled endpoints</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
