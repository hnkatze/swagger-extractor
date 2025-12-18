"use client";

import { useState, useMemo, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileUpload } from "./file-upload";
import { ApiInfoCard } from "./api-info-card";
import { TagsTable } from "./tags-table";
import { EndpointsPreview } from "./endpoints-preview";
import { ExportPanel } from "./export-panel";
import { analyzeTags } from "@/lib/swagger/analyzer";
import { extractByTags } from "@/lib/swagger/extractor";
import type { SwaggerDocument, TagInfo, ExtractionResult } from "@/lib/types/swagger";

export function SwaggerExtractor() {
  const [swagger, setSwagger] = useState<SwaggerDocument | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [tagsInfo, setTagsInfo] = useState<Map<string, TagInfo>>(new Map());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const handleFileLoaded = useCallback((doc: SwaggerDocument, name: string) => {
    setSwagger(doc);
    setFilename(name);
    const tags = analyzeTags(doc);
    setTagsInfo(tags);
    setSelectedTags(new Set());
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
      {/* Header with reset button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Swagger Analysis</h2>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Load Different File
        </Button>
      </div>

      {/* API Info */}
      <ApiInfoCard swagger={swagger} tagsInfo={tagsInfo} filename={filename} />

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
          <EndpointsPreview tagsInfo={tagsInfo} selectedTags={selectedTags} swagger={swagger} />
          <ExportPanel result={extractionResult} />
        </div>
      </div>
    </div>
  );
}
