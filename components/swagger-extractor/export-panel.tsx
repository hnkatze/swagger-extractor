"use client";

import { useState, useMemo } from "react";
import { Copy, Download, Check, FileText, Hash, Sparkles, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ExtractionResult } from "@/lib/types/swagger";
import { toJson } from "@/lib/formatters/json-formatter";
import { toToon } from "@/lib/formatters/toon-formatter";

interface ExportPanelProps {
  result: ExtractionResult | null;
}

type ExportFormat = "toon" | "json";

function getStats(output: string) {
  const lines = output.split("\n").length;
  const chars = output.length;
  const tokens = Math.ceil(chars / 4); // Rough estimate: ~4 chars per token
  return { lines, chars, tokens };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Simple syntax highlighting for JSON
function highlightJson(json: string): React.ReactNode {
  const parts = json.split(/("(?:[^"\\]|\\.)*")/g);
  return parts.map((part, i) => {
    if (part.startsWith('"') && part.endsWith('"')) {
      // Check if it's a key (followed by :) or value
      const isKey = json.indexOf(part + ":") !== -1 || json.indexOf(part + " :") !== -1;
      if (isKey) {
        return <span key={i} className="text-blue-600 dark:text-blue-400">{part}</span>;
      }
      return <span key={i} className="text-emerald-600 dark:text-emerald-400">{part}</span>;
    }
    // Highlight numbers and booleans
    return part.split(/(\b\d+\.?\d*\b|true|false|null)/g).map((p, j) => {
      if (/^\d+\.?\d*$/.test(p)) {
        return <span key={`${i}-${j}`} className="text-amber-600 dark:text-amber-400">{p}</span>;
      }
      if (p === "true" || p === "false" || p === "null") {
        return <span key={`${i}-${j}`} className="text-purple-600 dark:text-purple-400">{p}</span>;
      }
      return p;
    });
  });
}

// Simple syntax highlighting for TOON
function highlightToon(toon: string): React.ReactNode {
  return toon.split("\n").map((line, i) => {
    // Key: value pattern
    if (line.includes(":")) {
      const [key, ...valueParts] = line.split(":");
      const value = valueParts.join(":");
      return (
        <div key={i}>
          <span className="text-blue-600 dark:text-blue-400">{key}</span>
          <span>:</span>
          <span className="text-emerald-600 dark:text-emerald-400">{value}</span>
        </div>
      );
    }
    // Data rows (indented)
    if (line.startsWith("  ") || line.startsWith("\t")) {
      return <div key={i} className="text-muted-foreground">{line}</div>;
    }
    return <div key={i}>{line}</div>;
  });
}

export function ExportPanel({ result }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("toon");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    if (!result) return "";
    return format === "toon" ? toToon(result) : toJson(result);
  }, [result, format]);

  const stats = useMemo(() => getStats(output), [output]);

  const filename = useMemo(() => {
    if (!result) return "api-extracted";
    const slug = slugify(result.api);
    return `${slug}-extracted`;
  }, [result]);

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
    const fullFilename = `${filename}${extension}`;

    const blob = new Blob([output], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fullFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${fullFilename}`);
  };

  const highlightedOutput = useMemo(() => {
    if (!output) return null;
    return format === "json" ? highlightJson(output) : highlightToon(output);
  }, [output, format]);

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

        {/* Output stats */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 font-normal">
            <FileText className="h-3 w-3" />
            {stats.lines} lines
          </Badge>
          <Badge variant="outline" className="gap-1.5 font-normal">
            <Hash className="h-3 w-3" />
            {stats.chars.toLocaleString()} chars
          </Badge>
          <Badge variant="outline" className="gap-1.5 font-normal text-purple-600 dark:text-purple-400 border-purple-500/30">
            <Sparkles className="h-3 w-3" />
            ~{stats.tokens.toLocaleString()} tokens
          </Badge>

          {/* Expand button */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto h-6 gap-1 px-2">
                <Maximize2 className="h-3 w-3" />
                Expand
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Export Preview
                  <Badge variant="secondary">{format.toUpperCase()}</Badge>
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 rounded-md border bg-muted/30">
                <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all">
                  {highlightedOutput}
                </pre>
              </ScrollArea>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
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
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="h-[300px] rounded-md border bg-muted/30">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
            {highlightedOutput}
          </pre>
        </ScrollArea>

        {/* Filename preview */}
        <p className="text-xs text-muted-foreground">
          File: <code className="bg-muted px-1 py-0.5 rounded">{filename}.{format}</code>
        </p>

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
