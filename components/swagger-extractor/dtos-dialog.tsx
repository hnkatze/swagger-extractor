"use client";

import { useState, useMemo } from "react";
import { Copy, Check, Download, Code2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SwaggerDocument, EndpointInfo, SchemaObject } from "@/lib/types/swagger";
import { getSchemas } from "@/lib/swagger/parser";
import {
  generateDtos,
  collectUsedSchemas,
  DTO_LANGUAGES,
  type DtoLanguage,
} from "@/lib/dto-generators";

interface DtosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  swagger: SwaggerDocument;
  endpoint: EndpointInfo;
}

export function DtosDialog({
  open,
  onOpenChange,
  swagger,
  endpoint,
}: DtosDialogProps) {
  const [activeLang, setActiveLang] = useState<DtoLanguage>("typescript");
  const [copied, setCopied] = useState(false);

  const allSchemas = useMemo(
    () => getSchemas(swagger) as Record<string, SchemaObject>,
    [swagger]
  );

  // Build a single-endpoint map for collectUsedSchemas
  const schemaNames = useMemo(
    () =>
      collectUsedSchemas(
        { _: [{ body: endpoint.body, response: endpoint.response }] },
        allSchemas
      ),
    [endpoint, allSchemas]
  );

  const generatedCode = useMemo(
    () => generateDtos(allSchemas, schemaNames, activeLang),
    [allSchemas, schemaNames, activeLang]
  );

  const langInfo = DTO_LANGUAGES.find((l) => l.id === activeLang)!;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast.success(`${langInfo.label} DTOs copied!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const downloadFile = () => {
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dtos${langInfo.extension}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded dtos${langInfo.extension}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Code2 className="h-5 w-5" />
            <span>DTOs</span>
            <Badge variant="secondary">
              {endpoint.method}
            </Badge>
            <code className="text-xs font-mono text-muted-foreground">
              {endpoint.path}
            </code>
            <Badge variant="outline" className="ml-auto">
              {schemaNames.length} schemas
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeLang}
          onValueChange={(v) => {
            setActiveLang(v as DtoLanguage);
            setCopied(false);
          }}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="flex items-center justify-between gap-2 shrink-0">
            <TabsList className="flex-wrap h-auto">
              {DTO_LANGUAGES.map((lang) => (
                <TabsTrigger key={lang.id} value={lang.id} className="text-xs">
                  {lang.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={downloadFile}
              >
                <Download className="h-3.5 w-3.5" />
                {langInfo.extension}
              </Button>
            </div>
          </div>

          {DTO_LANGUAGES.map((lang) => (
            <TabsContent
              key={lang.id}
              value={lang.id}
              className="flex-1 min-h-0 mt-2"
            >
              <ScrollArea className="h-[55vh] rounded-md border bg-muted/30">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
                  {generatedCode || (
                    <span className="text-muted-foreground">
                      No schemas found for this endpoint.
                    </span>
                  )}
                </pre>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        {schemaNames.length > 0 && (
          <div className="shrink-0 pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Schemas:{" "}
              <span className="font-mono">
                {schemaNames.join(", ")}
              </span>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
