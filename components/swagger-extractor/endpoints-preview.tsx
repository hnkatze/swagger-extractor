"use client";

import { ChevronDown, ArrowRightLeft, ArrowRight, Eye, Play } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useState } from "react";
import { getSchemas } from "@/lib/swagger/parser";
import { simplifySchema } from "@/lib/swagger/schema-simplifier";
import { ApiTester } from "@/components/api-tester/api-tester";
import type { ApiConfigState } from "@/components/api-tester/api-config";

interface EndpointsPreviewProps {
  tagsInfo: Map<string, TagInfo>;
  selectedTags: Set<string>;
  swagger?: SwaggerDocument | null;
  apiConfig?: ApiConfigState;
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

// Get schema fields for display
function getSchemaFields(
  schemaName: string | undefined,
  allSchemas: Record<string, unknown>
): Record<string, string> | null {
  if (!schemaName) return null;
  const cleanName = schemaName.replace("[]", "");
  const schema = allSchemas[cleanName];
  if (!schema) return null;
  return simplifySchema(schema as Record<string, unknown>, allSchemas as Record<string, Record<string, unknown>>);
}

export function EndpointsPreview({
  tagsInfo,
  selectedTags,
  swagger,
  apiConfig,
}: EndpointsPreviewProps) {
  const [openTags, setOpenTags] = useState<Set<string>>(new Set(selectedTags));
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testerEndpoint, setTesterEndpoint] = useState<EndpointInfo | null>(null);
  const [testerOpen, setTesterOpen] = useState(false);

  const allSchemas = swagger ? getSchemas(swagger) : {};

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
  const totalEndpoints = selectedTagsArray.reduce((sum, tagName) => {
    const tag = tagsInfo.get(tagName);
    return sum + (tag?.total || 0);
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Endpoints Preview</span>
          <Badge variant="secondary">{totalEndpoints} endpoints</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px]">
          <div className="p-4 pt-0 space-y-2">
            {selectedTagsArray.map((tagName) => {
              const tag = tagsInfo.get(tagName);
              if (!tag) return null;

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
                        {tag.total}
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
                      {tag.paths.map((endpoint, idx) => (
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
          <DialogHeader>
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
                  <code className="font-mono text-sm break-all">
                    {selectedEndpoint.path}
                  </code>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedEndpoint && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {/* Summary */}
                {selectedEndpoint.summary && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Summary</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedEndpoint.summary}
                    </p>
                  </div>
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
                      const fields = getSchemaFields(selectedEndpoint.body, allSchemas);
                      if (!fields) return <p className="text-xs text-muted-foreground">Schema not found</p>;
                      return (
                        <div className="rounded-md border bg-muted/30 p-3">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {Object.entries(fields).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-blue-600 dark:text-blue-400">{key}</span>
                                <span className="text-muted-foreground">: </span>
                                <span className="text-emerald-600 dark:text-emerald-400">{value}</span>
                              </div>
                            ))}
                          </pre>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Response */}
                {selectedEndpoint.response && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-emerald-500" />
                      Response
                      <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400">
                        {selectedEndpoint.response}
                      </Badge>
                    </h4>
                    {(() => {
                      const fields = getSchemaFields(selectedEndpoint.response, allSchemas);
                      if (!fields) return <p className="text-xs text-muted-foreground">Schema not found</p>;
                      return (
                        <div className="rounded-md border bg-muted/30 p-3">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {Object.entries(fields).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-blue-600 dark:text-blue-400">{key}</span>
                                <span className="text-muted-foreground">: </span>
                                <span className="text-emerald-600 dark:text-emerald-400">{value}</span>
                              </div>
                            ))}
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
            </ScrollArea>
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
    </Card>
  );
}
