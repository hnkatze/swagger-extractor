"use client";

import { useCallback, useState } from "react";
import { Upload, FileJson, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseSwagger } from "@/lib/swagger/parser";
import type { SwaggerDocument } from "@/lib/types/swagger";

interface FileUploadProps {
  onFileLoaded: (swagger: SwaggerDocument, filename: string) => void;
  onError: (error: string) => void;
}

export function FileUpload({ onFileLoaded, onError }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [jsonText, setJsonText] = useState("");

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

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="upload" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload File
        </TabsTrigger>
        <TabsTrigger value="paste" className="gap-2">
          <ClipboardPaste className="h-4 w-4" />
          Paste JSON
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-4">
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
      </TabsContent>

      <TabsContent value="paste" className="mt-4 space-y-4">
        <Textarea
          placeholder='Paste your swagger.json content here...&#10;&#10;{&#10;  "openapi": "3.0.0",&#10;  "info": { ... },&#10;  "paths": { ... }&#10;}'
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="min-h-[250px] font-mono text-sm"
        />
        <Button onClick={handlePasteSubmit} className="w-full gap-2">
          <FileJson className="h-4 w-4" />
          Parse Swagger
        </Button>
      </TabsContent>
    </Tabs>
  );
}
