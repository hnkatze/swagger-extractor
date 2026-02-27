"use client";

import { ChevronDown, ArrowRightLeft, ArrowRight, Eye, Play, Copy, Check, Search, X, Code2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TagInfo, EndpointInfo, SwaggerDocument } from "@/lib/types/swagger";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { getSchemas } from "@/lib/swagger/parser";
import { resolveSchemaDeep } from "@/lib/swagger/schema-simplifier";
import type { DeepSchemaField } from "@/lib/swagger/schema-simplifier";
import { ApiTester } from "@/components/api-tester/api-tester";
import type { ApiConfigState } from "@/components/api-tester/api-config";
import { DtosDialog } from "@/components/swagger-extractor/dtos-dialog";

interface EndpointsPreviewProps {
  tagsInfo: Map<string, TagInfo>;
  selectedTags: Set<string>;
  swagger?: SwaggerDocument | null;
  apiConfig?: ApiConfigState;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500 text-white",
  POST: "bg-blue-500 text-white",
  PUT: "bg-amber-500 text-white",
  PATCH: "bg-orange-500 text-white",
  DELETE: "bg-red-500 text-white",
};

// Parse param string like "name*(path)" into structured data
function parseParam(param: string): { name: string; required: boolean; location: string } {
  const required = param.includes("*");
  const locationMatch = param.match(/\(([^)]+)\)$/);
  const location = locationMatch ? locationMatch[1] : "query";
  const name = param.replace("*", "").replace(/\([^)]+\)$/, "");
  return { name, required, location };
}

// Get deeply resolved schema fields (with nested DTOs expanded)
function getDeepSchemaFields(
  schemaName: string | undefined,
  allSchemas: Record<string, unknown>
): Record<string, DeepSchemaField> | null {
  if (!schemaName) return null;
  return resolveSchemaDeep(
    schemaName,
    allSchemas as Record<string, Record<string, unknown>>
  );
}

// Render deep schema fields recursively
function DeepFieldsView({ fields, depth = 0 }: { fields: Record<string, DeepSchemaField>; depth?: number }) {
  return (
    <>
      {Object.entries(fields).map(([key, field]) => (
        <div key={key}>
          <div style={{ paddingLeft: `${depth * 16}px` }}>
            <span className="text-blue-600 dark:text-blue-400">{key}</span>
            <span className="text-muted-foreground">: </span>
            <span className={cn(
              field.fields ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-600 dark:text-emerald-400"
            )}>
              {field.type}
            </span>
          </div>
          {field.fields && (
            <DeepFieldsView fields={field.fields} depth={depth + 1} />
          )}
        </div>
      ))}
    </>
  );
}

// Convert deep fields to a flat JSON structure for copying
function deepFieldsToJson(fields: Record<string, DeepSchemaField>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field.fields) {
      result[key] = {
        _type: field.type,
        ...deepFieldsToJson(field.fields),
      };
    } else {
      result[key] = field.type;
    }
  }
  return result;
}

// Collapsible text component for long summary/description
const MAX_CHARS = 200;

function CollapsibleText({
  summary,
  description,
}: {
  summary?: string;
  description?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalLength = (summary?.length || 0) + (description?.length || 0);
  const needsCollapse = totalLength > MAX_CHARS;

  const content = (
    <div className="space-y-2">
      {summary && (
        <div>
          <h4 className="text-sm font-medium mb-1">Summary</h4>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
      )}
      {description && (
        <div>
          <h4 className="text-sm font-medium mb-1">Description</h4>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {description}
          </p>
        </div>
      )}
    </div>
  );

  if (!needsCollapse) {
    return content;
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="rounded-md border bg-muted/30 p-3">
        {isExpanded ? (
          <div className="max-h-[300px] overflow-auto pr-2">
            {content}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {summary || description}
          </p>
        )}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-6 px-2 text-xs w-full"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 mr-1 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
            {isExpanded ? "Show less" : "Show more"}
          </Button>
        </CollapsibleTrigger>
      </div>
    </Collapsible>
  );
}

export function EndpointsPreview({
  tagsInfo,
  selectedTags,
  swagger,
  apiConfig,
  searchQuery,
  onSearchChange,
}: EndpointsPreviewProps) {
  const [openTags, setOpenTags] = useState<Set<string>>(new Set(selectedTags));
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testerEndpoint, setTesterEndpoint] = useState<EndpointInfo | null>(null);
  const [testerOpen, setTesterOpen] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [dtosOpen, setDtosOpen] = useState(false);
  const [dtosEndpoint, setDtosEndpoint] = useState<EndpointInfo | null>(null);

  const allSchemas = swagger ? getSchemas(swagger) : {};

  const openDtos = (endpoint: EndpointInfo) => {
    setDtosEndpoint(endpoint);
    setDtosOpen(true);
  };

  // Filter endpoints by search query
  const filterEndpoints = useMemo(() => {
    return (endpoints: EndpointInfo[]) => {
      if (!searchQuery.trim()) return endpoints;
      const query = searchQuery.toLowerCase();
      return endpoints.filter(
        (ep) =>
          ep.path.toLowerCase().includes(query) ||
          ep.method.toLowerCase().includes(query) ||
          ep.summary?.toLowerCase().includes(query) ||
          ep.description?.toLowerCase().includes(query)
      );
    };
  }, [searchQuery]);

  // Count total filtered endpoints
  const totalFilteredEndpoints = useMemo(() => {
    let count = 0;
    selectedTags.forEach((tag) => {
      const tagInfo = tagsInfo.get(tag);
      if (tagInfo) {
        count += filterEndpoints(tagInfo.paths).length;
      }
    });
    return count;
  }, [selectedTags, tagsInfo, filterEndpoints]);

  // Count total endpoints
  const totalEndpoints = useMemo(() => {
    let count = 0;
    selectedTags.forEach((tag) => {
      const tagInfo = tagsInfo.get(tag);
      if (tagInfo) {
        count += tagInfo.paths.length;
      }
    });
    return count;
  }, [selectedTags, tagsInfo]);

  // Copy endpoint path (e.g., "GET /api/users/{id}")
  const copyEndpointPath = async (endpoint: EndpointInfo) => {
    const text = `${endpoint.method} ${endpoint.path}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPath(`${endpoint.method}-${endpoint.path}`);
      toast.success("Path copied!");
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Copy full endpoint JSON (for documentation)
  const copyEndpointJson = async (endpoint: EndpointInfo) => {
    const bodyDeep = endpoint.body ? getDeepSchemaFields(endpoint.body, allSchemas) : null;
    const responseDeep = endpoint.response ? getDeepSchemaFields(endpoint.response, allSchemas) : null;

    const json = {
      method: endpoint.method,
      path: endpoint.path,
      summary: endpoint.summary || undefined,
      description: endpoint.description || undefined,
      parameters: endpoint.params?.map(p => parseParam(p)) || undefined,
      requestBody: bodyDeep ? { schema: endpoint.body, fields: deepFieldsToJson(bodyDeep), example: endpoint.bodyExample } : undefined,
      response: responseDeep ? { schema: endpoint.response, fields: deepFieldsToJson(responseDeep) } : undefined,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      setCopiedJson(true);
      toast.success("JSON copied!");
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Copy response schema as JSON
  const copyResponseSchema = async (endpoint: EndpointInfo) => {
    const responseDeep = endpoint.response ? getDeepSchemaFields(endpoint.response, allSchemas) : null;
    if (!responseDeep) {
      toast.error("No response schema available");
      return;
    }

    const json = {
      schema: endpoint.response,
      fields: deepFieldsToJson(responseDeep),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      setCopiedResponse(true);
      toast.success("Response copied!");
      setTimeout(() => setCopiedResponse(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const openEndpointDetail = (endpoint: EndpointInfo) => {
    setSelectedEndpoint(endpoint);
    setDialogOpen(true);
  };

  const openApiTester = (endpoint: EndpointInfo) => {
    setTesterEndpoint(endpoint);
    setTesterOpen(true);
  };

  const toggleTag = (tagName: string) => {
    const newOpen = new Set(openTags);
    if (newOpen.has(tagName)) {
      newOpen.delete(tagName);
    } else {
      newOpen.add(tagName);
    }
    setOpenTags(newOpen);
  };

  if (selectedTags.size === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Endpoints Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select tags above to preview endpoints
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedTagsArray = Array.from(selectedTags).sort();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Endpoints Preview</span>
          <Badge variant="secondary">
            {searchQuery.trim()
              ? `${totalFilteredEndpoints} of ${totalEndpoints}`
              : totalEndpoints}{" "}
            endpoints
          </Badge>
        </CardTitle>
        {/* Search input */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px]">
          <div className="p-4 pt-0 space-y-2">
            {selectedTagsArray.map((tagName) => {
              const tag = tagsInfo.get(tagName);
              if (!tag) return null;

              const filteredPaths = filterEndpoints(tag.paths);
              if (filteredPaths.length === 0 && searchQuery.trim()) return null;

              const isOpen = openTags.has(tagName);

              return (
                <Collapsible
                  key={tagName}
                  open={isOpen}
                  onOpenChange={() => toggleTag(tagName)}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/50 px-4 py-3 text-left font-medium transition-colors hover:bg-muted">
                    <span className="flex items-center gap-2">
                      {tagName}
                      <Badge variant="outline" className="ml-1">
                        {searchQuery.trim()
                          ? `${filteredPaths.length}/${tag.total}`
                          : tag.total}
                      </Badge>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-1 pl-2">
                      {filteredPaths.map((endpoint, idx) => (
                        <div
                          key={`${endpoint.method}-${endpoint.path}-${idx}`}
                          className="rounded-md border bg-card p-2.5 text-sm space-y-1.5"
                        >
                          {/* Method + Path + View Button */}
                          <div className="flex items-start gap-2">
                            <Badge
                              className={cn(
                                "shrink-0 font-mono text-xs",
                                METHOD_COLORS[endpoint.method] || "bg-gray-500"
                              )}
                            >
                              {endpoint.method}
                            </Badge>
                            <code className="font-mono text-xs break-all flex-1">
                              {endpoint.path}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 shrink-0"
                              title="Copy path"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyEndpointPath(endpoint);
                              }}
                            >
                              {copiedPath === `${endpoint.method}-${endpoint.path}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 shrink-0"
                              title="View details"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEndpointDetail(endpoint);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 shrink-0 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                              title="Test endpoint"
                              onClick={(e) => {
                                e.stopPropagation();
                                openApiTester(endpoint);
                              }}
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                            {(endpoint.body || endpoint.response) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 shrink-0 text-violet-600 hover:text-violet-700 dark:text-violet-400"
                                title="Generate DTOs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDtos(endpoint);
                                }}
                              >
                                <Code2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>

                          {/* Summary */}
                          {endpoint.summary && (
                            <p className="text-muted-foreground text-xs pl-1">
                              {endpoint.summary}
                            </p>
                          )}

                          {/* Params, Body, Response badges */}
                          {(endpoint.params?.length || endpoint.body || endpoint.response) && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {endpoint.params && endpoint.params.length > 0 && (
                                <Badge variant="outline" className="text-xs font-normal gap-1">
                                  <span className="text-muted-foreground">params:</span>
                                  {endpoint.params.length}
                                </Badge>
                              )}
                              {endpoint.body && (
                                <Badge variant="outline" className="text-xs font-normal gap-1 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                  <ArrowRightLeft className="h-3 w-3" />
                                  {endpoint.body}
                                </Badge>
                              )}
                              {endpoint.response && (
                                <Badge variant="outline" className="text-xs font-normal gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                  <ArrowRight className="h-3 w-3" />
                                  {endpoint.response}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Endpoint Detail Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {selectedEndpoint && (
                <>
                  <Badge
                    className={cn(
                      "font-mono text-xs",
                      METHOD_COLORS[selectedEndpoint.method] || "bg-gray-500"
                    )}
                  >
                    {selectedEndpoint.method}
                  </Badge>
                  <code className="font-mono text-sm break-all flex-1">
                    {selectedEndpoint.path}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 ml-auto"
                    onClick={() => copyEndpointJson(selectedEndpoint)}
                  >
                    {copiedJson ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy JSON
                      </>
                    )}
                  </Button>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedEndpoint && (
            <div className="overflow-y-auto min-h-0 pr-2">
              <div className="space-y-4">
                {/* Summary & Description - Collapsible when long */}
                {(selectedEndpoint.summary || selectedEndpoint.description) && (
                  <CollapsibleText
                    summary={selectedEndpoint.summary}
                    description={selectedEndpoint.description}
                  />
                )}

                {/* Parameters */}
                {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Parameters</h4>
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Name</th>
                            <th className="text-left px-3 py-2 font-medium">Location</th>
                            <th className="text-left px-3 py-2 font-medium">Required</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEndpoint.params.map((param, i) => {
                            const parsed = parseParam(param);
                            return (
                              <tr key={i} className="border-t">
                                <td className="px-3 py-2 font-mono text-xs">{parsed.name}</td>
                                <td className="px-3 py-2">
                                  <Badge variant="outline" className="text-xs">
                                    {parsed.location}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2">
                                  {parsed.required ? (
                                    <Badge className="bg-red-500 text-white text-xs">Yes</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">No</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Request Body */}
                {selectedEndpoint.body && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                      Request Body
                      <Badge variant="outline" className="text-xs text-blue-600 dark:text-blue-400">
                        {selectedEndpoint.body}
                      </Badge>
                    </h4>
                    {(() => {
                      const deepFields = getDeepSchemaFields(selectedEndpoint.body, allSchemas);
                      if (!deepFields) return <p className="text-xs text-muted-foreground">Schema not found</p>;
                      return (
                        <div className="rounded-md border bg-muted/30 p-3">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            <DeepFieldsView fields={deepFields} />
                          </pre>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Body Example */}
                {selectedEndpoint.bodyExample !== undefined && selectedEndpoint.bodyExample !== null ? (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-amber-500" />
                      Example
                      <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400">
                        JSON
                      </Badge>
                    </h4>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(selectedEndpoint.bodyExample, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : null}

                {/* Response */}
                {selectedEndpoint.response && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-emerald-500" />
                      Response
                      <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400">
                        {selectedEndpoint.response}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 ml-auto"
                        onClick={() => copyResponseSchema(selectedEndpoint)}
                      >
                        {copiedResponse ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </h4>
                    {(() => {
                      const deepFields = getDeepSchemaFields(selectedEndpoint.response, allSchemas);
                      if (!deepFields) return <p className="text-xs text-muted-foreground">Schema not found</p>;
                      return (
                        <div className="rounded-md border bg-muted/30 p-3">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            <DeepFieldsView fields={deepFields} />
                          </pre>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* No details available */}
                {!selectedEndpoint.params?.length && !selectedEndpoint.body && !selectedEndpoint.response && !selectedEndpoint.summary && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No additional details available for this endpoint.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* API Tester Modal */}
      <ApiTester
        endpoint={testerEndpoint}
        config={apiConfig ?? { baseUrl: "", auth: { type: "none" } }}
        open={testerOpen}
        onOpenChange={setTesterOpen}
      />

      {/* DTOs Generator Modal */}
      {swagger && dtosEndpoint && (
        <DtosDialog
          open={dtosOpen}
          onOpenChange={setDtosOpen}
          swagger={swagger}
          endpoint={dtosEndpoint}
        />
      )}
    </Card>
  );
}
