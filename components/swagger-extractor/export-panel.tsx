"use client";

import { useState, useMemo } from "react";
import { Copy, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { ExtractionResult } from "@/lib/types/swagger";
import { toJson } from "@/lib/formatters/json-formatter";
import { toToon } from "@/lib/formatters/toon-formatter";

interface ExportPanelProps {
  result: ExtractionResult | null;
}

type ExportFormat = "toon" | "json";

export function ExportPanel({ result }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("toon");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    if (!result) return "";
    return format === "toon" ? toToon(result) : toJson(result);
  }, [result, format]);

  const handleCopy = async () => {
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleDownload = () => {
    if (!output || !result) return;

    const extension = format === "toon" ? ".toon" : ".json";
    const mimeType = format === "toon" ? "text/plain" : "application/json";
    const filename = `api-extracted${extension}`;

    const blob = new Blob([output], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${filename}`);
  };

  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select tags to generate output
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={format}
          onValueChange={(v) => setFormat(v as ExportFormat)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="toon">TOON</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="toon" className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Token-Oriented Object Notation - Optimized for LLM prompts (~40%
              fewer tokens)
            </p>
          </TabsContent>

          <TabsContent value="json" className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Standard JSON format - Compatible with all systems
            </p>
          </TabsContent>
        </Tabs>

        <ScrollArea className="h-[300px] rounded-md border bg-muted/30">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
            {output}
          </pre>
        </ScrollArea>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </>
            )}
          </Button>
          <Button className="flex-1 gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Download .{format}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
