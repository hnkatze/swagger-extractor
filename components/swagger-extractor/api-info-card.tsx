"use client";

import { FileJson, Tag } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SwaggerDocument, TagInfo } from "@/lib/types/swagger";

interface ApiInfoCardProps {
  swagger: SwaggerDocument;
  tagsInfo: Map<string, TagInfo>;
  filename: string;
}

export function ApiInfoCard({ swagger, tagsInfo, filename }: ApiInfoCardProps) {
  const { title, version, description } = swagger.info;
  const totalEndpoints = Array.from(tagsInfo.values()).reduce(
    (sum, tag) => sum + tag.total,
    0
  );
  const totalTags = tagsInfo.size;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Badge variant="secondary">v{version}</Badge>
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1 text-sm">
                <FileJson className="h-3.5 w-3.5" />
                {filename}
              </span>
            </CardDescription>
          </div>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground pt-2">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-semibold">{totalTags}</span> tags
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-semibold">{totalEndpoints}</span> endpoints
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
