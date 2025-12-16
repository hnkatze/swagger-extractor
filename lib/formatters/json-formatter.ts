import type { ExtractionResult } from "@/lib/types/swagger";

/**
 * Format extraction result as JSON
 */
export function toJson(data: ExtractionResult, pretty = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}
