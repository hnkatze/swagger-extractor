"use client";

import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TagInfo } from "@/lib/types/swagger";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface EndpointsPreviewProps {
  tagsInfo: Map<string, TagInfo>;
  selectedTags: Set<string>;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500 text-white",
  POST: "bg-blue-500 text-white",
  PUT: "bg-amber-500 text-white",
  PATCH: "bg-orange-500 text-white",
  DELETE: "bg-red-500 text-white",
};

export function EndpointsPreview({
  tagsInfo,
  selectedTags,
}: EndpointsPreviewProps) {
  const [openTags, setOpenTags] = useState<Set<string>>(new Set(selectedTags));

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
                          className="flex items-start gap-2 rounded-md border bg-card p-2.5 text-sm"
                        >
                          <Badge
                            className={cn(
                              "shrink-0 font-mono text-xs",
                              METHOD_COLORS[endpoint.method] || "bg-gray-500"
                            )}
                          >
                            {endpoint.method}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <code className="font-mono text-xs break-all">
                              {endpoint.path}
                            </code>
                            {endpoint.summary && (
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {endpoint.summary}
                              </p>
                            )}
                          </div>
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
    </Card>
  );
}
