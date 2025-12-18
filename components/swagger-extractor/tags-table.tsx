"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, Square, Search } from "lucide-react";
import type { TagInfo } from "@/lib/types/swagger";
import { sortTagsByName } from "@/lib/swagger/analyzer";
import { cn } from "@/lib/utils";

interface TagsTableProps {
  tagsInfo: Map<string, TagInfo>;
  selectedTags: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  PATCH: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
};

const METHOD_FILTER_COLORS: Record<string, string> = {
  GET: "data-[active=true]:bg-emerald-500 data-[active=true]:text-white data-[active=true]:border-emerald-500",
  POST: "data-[active=true]:bg-blue-500 data-[active=true]:text-white data-[active=true]:border-blue-500",
  PUT: "data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:border-amber-500",
  PATCH: "data-[active=true]:bg-orange-500 data-[active=true]:text-white data-[active=true]:border-orange-500",
  DELETE: "data-[active=true]:bg-red-500 data-[active=true]:text-white data-[active=true]:border-red-500",
};

export function TagsTable({
  tagsInfo,
  selectedTags,
  onSelectionChange,
}: TagsTableProps) {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<HttpMethod | null>(null);

  const sortedTags = useMemo(() => sortTagsByName(tagsInfo), [tagsInfo]);

  const filteredTags = useMemo(() => {
    let tags = sortedTags;

    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase();
      tags = tags.filter((tag) => tag.name.toLowerCase().includes(query));
    }

    // Filter by HTTP method
    if (methodFilter) {
      tags = tags.filter((tag) => tag.methods[methodFilter] > 0);
    }

    return tags;
  }, [sortedTags, search, methodFilter]);

  const allSelected = selectedTags.size === tagsInfo.size && tagsInfo.size > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(tagsInfo.keys()));
    }
  };

  const handleTagToggle = (tagName: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagName)) {
      newSelected.delete(tagName);
    } else {
      newSelected.add(tagName);
    }
    onSelectionChange(newSelected);
  };

  const toggleMethodFilter = (method: HttpMethod) => {
    setMethodFilter(methodFilter === method ? null : method);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Select Tags to Extract</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          className="gap-2"
        >
          {allSelected ? (
            <>
              <Square className="h-4 w-4" />
              Deselect All
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4" />
              Select All
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Method filter badges */}
        <div className="flex flex-wrap gap-1.5">
          {HTTP_METHODS.map((method) => (
            <Badge
              key={method}
              variant="outline"
              data-active={methodFilter === method}
              onClick={() => toggleMethodFilter(method)}
              className={cn(
                "cursor-pointer transition-colors",
                METHOD_FILTER_COLORS[method]
              )}
            >
              {method}
            </Badge>
          ))}
          {methodFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMethodFilter(null)}
              className="h-6 px-2 text-xs"
            >
              Clear filter
            </Button>
          )}
        </div>

        {/* Tags count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {filteredTags.length} of {sortedTags.length} tags
          </span>
          {selectedTags.size > 0 && (
            <span>{selectedTags.size} selected</span>
          )}
        </div>

        {/* Scrollable table */}
        <ScrollArea className="h-[400px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="text-center w-24">Endpoints</TableHead>
                <TableHead>Methods</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {search || methodFilter
                      ? "No tags found matching filters"
                      : "No tags available"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTags.map((tag) => (
                  <TableRow
                    key={tag.name}
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag.name)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedTags.has(tag.name)}
                        onCheckedChange={() => handleTagToggle(tag.name)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{tag.total}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(tag.methods)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([method, count]) => (
                            <Badge
                              key={method}
                              variant="outline"
                              className={METHOD_COLORS[method] || ""}
                            >
                              {method}: {count}
                            </Badge>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
