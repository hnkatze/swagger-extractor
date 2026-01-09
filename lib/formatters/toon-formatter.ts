import type { ExtractionResult, EndpointInfo } from "@/lib/types/swagger";

/**
 * Escape a value for TOON format (only if needed)
 */
function escapeValue(value: string): string {
  // Quote if contains special characters
  if (value.includes(",") || value.includes("\n") || value.includes(":")) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Format extraction result as TOON (Token-Oriented Object Notation)
 *
 * TOON spec:
 * - Indentation instead of braces
 * - Arrays: name[N]: value1,value2,value3
 * - Structured arrays: name[N]{field1,field2}:\n  val1,val2\n  val3,val4
 * - No quotes unless necessary
 */
export function toToon(data: ExtractionResult): string {
  const lines: string[] = [];

  // API info
  lines.push(`api: ${escapeValue(data.api)}`);

  // Extracted tags (simple array)
  const tags = data.extracted_tags;
  lines.push(`extracted_tags[${tags.length}]: ${tags.join(",")}`);

  // Endpoints section
  lines.push("endpoints:");

  for (const [tag, endpoints] of Object.entries(data.endpoints)) {
    if (endpoints.length === 0) continue;

    // Determine which fields are present in this tag's endpoints
    const hasDesc = endpoints.some((e) => e.description);
    const hasParams = endpoints.some((e) => e.params?.length);
    const hasBody = endpoints.some((e) => e.body);
    const hasResponse = endpoints.some((e) => e.response);

    // Build fields list - always include path, method, summary
    const fields = ["path", "method", "summary"];
    if (hasDesc) fields.push("desc");
    if (hasParams) fields.push("params");
    if (hasBody) fields.push("body");
    if (hasResponse) fields.push("response");

    // Header with schema
    lines.push(`  ${tag}[${endpoints.length}]{${fields.join(",")}}:`);

    // Data rows
    for (const ep of endpoints) {
      const values: string[] = [
        escapeValue(ep.path),
        ep.method,
        escapeValue(ep.summary || ""),
      ];

      if (hasDesc) {
        values.push(escapeValue(ep.description || ""));
      }
      if (hasParams) {
        values.push(ep.params?.join(";") || "");
      }
      if (hasBody) {
        values.push(ep.body || "");
      }
      if (hasResponse) {
        values.push(ep.response || "");
      }

      lines.push(`    ${values.join(",")}`);
    }
  }

  // Schemas section
  lines.push("schemas:");

  for (const [schemaName, fields] of Object.entries(data.schemas)) {
    lines.push(`  ${schemaName}:`);
    for (const [fieldName, fieldType] of Object.entries(fields)) {
      lines.push(`    ${fieldName}: ${escapeValue(fieldType)}`);
    }
  }

  return lines.join("\n");
}
