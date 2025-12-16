"use client";

import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { CheckSquare, Square } from "lucide-react";
import type { TagInfo } from "@/lib/types/swagger";
import { sortTagsByName } from "@/lib/swagger/analyzer";

interface TagsTableProps {
  tagsInfo: Map<string, TagInfo>;
  selectedTags: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  PATCH: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
};

export function TagsTable({
  tagsInfo,
  selectedTags,
  onSelectionChange,
}: TagsTableProps) {
  const sortedTags = useMemo(() => sortTagsByName(tagsInfo), [tagsInfo]);

  const allSelected = selectedTags.size === tagsInfo.size;
  const someSelected = selectedTags.size > 0 && !allSelected;

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
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="text-center w-24">Endpoints</TableHead>
                <TableHead>Methods</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTags.map((tag) => (
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
              ))}
            </TableBody>
          </Table>
        </div>
        {selectedTags.size > 0 && (
          <p className="text-sm text-muted-foreground mt-3">
            {selectedTags.size} tag{selectedTags.size !== 1 ? "s" : ""} selected
          </p>
        )}
      </CardContent>
    </Card>
  );
}
