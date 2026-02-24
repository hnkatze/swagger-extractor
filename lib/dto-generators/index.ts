import type { SchemaObject } from "@/lib/types/swagger";
import { simplifySchema } from "@/lib/swagger/schema-simplifier";

export type DtoLanguage =
  | "typescript"
  | "csharp"
  | "dart"
  | "java"
  | "python"
  | "go"
  | "kotlin";

export interface DtoLanguageInfo {
  id: DtoLanguage;
  label: string;
  extension: string;
}

export const DTO_LANGUAGES: DtoLanguageInfo[] = [
  { id: "typescript", label: "TypeScript", extension: ".ts" },
  { id: "csharp", label: "C#", extension: ".cs" },
  { id: "dart", label: "Dart", extension: ".dart" },
  { id: "java", label: "Java", extension: ".java" },
  { id: "python", label: "Python", extension: ".py" },
  { id: "go", label: "Go", extension: ".go" },
  { id: "kotlin", label: "Kotlin", extension: ".kt" },
];

// Map OpenAPI type+format to each language's native type
function mapType(
  openApiType: string,
  lang: DtoLanguage
): string {
  // Handle arrays like "User[]" or "string[]"
  if (openApiType.endsWith("[]")) {
    const inner = openApiType.slice(0, -2);
    const mapped = mapType(inner, lang);
    switch (lang) {
      case "typescript":
        return `${mapped}[]`;
      case "csharp":
        return `List<${mapped}>`;
      case "dart":
        return `List<${mapped}>`;
      case "java":
        return `List<${mapped}>`;
      case "python":
        return `list[${mapped}]`;
      case "go":
        return `[]${mapped}`;
      case "kotlin":
        return `List<${mapped}>`;
    }
  }

  // Handle enums: "enum(value1, value2)"
  if (openApiType.startsWith("enum(")) {
    switch (lang) {
      case "typescript":
        return openApiType; // keep as-is, shown as union below
      case "csharp":
        return "string";
      case "dart":
        return "String";
      case "java":
        return "String";
      case "python":
        return "str";
      case "go":
        return "string";
      case "kotlin":
        return "String";
    }
  }

  // Handle format types: "string(date-time)", "string(uuid)", etc.
  const formatMatch = openApiType.match(/^(\w+)\(([^)]+)\)$/);
  if (formatMatch) {
    const [, baseType, format] = formatMatch;
    return mapFormattedType(baseType, format, lang);
  }

  // Handle reference types (PascalCase names = DTO references)
  if (/^[A-Z]/.test(openApiType)) {
    return openApiType; // Keep as-is, it's a DTO reference
  }

  // Basic type mapping
  return mapBasicType(openApiType, lang);
}

function mapBasicType(type: string, lang: DtoLanguage): string {
  const typeMap: Record<string, Record<DtoLanguage, string>> = {
    string: {
      typescript: "string",
      csharp: "string",
      dart: "String",
      java: "String",
      python: "str",
      go: "string",
      kotlin: "String",
    },
    number: {
      typescript: "number",
      csharp: "double",
      dart: "double",
      java: "double",
      python: "float",
      go: "float64",
      kotlin: "Double",
    },
    integer: {
      typescript: "number",
      csharp: "int",
      dart: "int",
      java: "int",
      python: "int",
      go: "int",
      kotlin: "Int",
    },
    boolean: {
      typescript: "boolean",
      csharp: "bool",
      dart: "bool",
      java: "boolean",
      python: "bool",
      go: "bool",
      kotlin: "Boolean",
    },
    object: {
      typescript: "Record<string, unknown>",
      csharp: "Dictionary<string, object>",
      dart: "Map<String, dynamic>",
      java: "Map<String, Object>",
      python: "dict[str, Any]",
      go: "map[string]interface{}",
      kotlin: "Map<String, Any>",
    },
    any: {
      typescript: "unknown",
      csharp: "object",
      dart: "dynamic",
      java: "Object",
      python: "Any",
      go: "interface{}",
      kotlin: "Any",
    },
  };

  return typeMap[type]?.[lang] ?? type;
}

function mapFormattedType(
  baseType: string,
  format: string,
  lang: DtoLanguage
): string {
  // date-time
  if (format === "date-time" || format === "date") {
    const dateMap: Record<DtoLanguage, string> = {
      typescript: "string",
      csharp: "DateTime",
      dart: "DateTime",
      java: "LocalDateTime",
      python: "datetime",
      go: "time.Time",
      kotlin: "LocalDateTime",
    };
    return dateMap[lang];
  }

  // uuid
  if (format === "uuid") {
    const uuidMap: Record<DtoLanguage, string> = {
      typescript: "string",
      csharp: "Guid",
      dart: "String",
      java: "UUID",
      python: "UUID",
      go: "string",
      kotlin: "UUID",
    };
    return uuidMap[lang];
  }

  // int32/int64
  if (format === "int32") {
    return mapBasicType("integer", lang);
  }
  if (format === "int64") {
    const int64Map: Record<DtoLanguage, string> = {
      typescript: "number",
      csharp: "long",
      dart: "int",
      java: "long",
      python: "int",
      go: "int64",
      kotlin: "Long",
    };
    return int64Map[lang];
  }

  // float/double
  if (format === "float") {
    const floatMap: Record<DtoLanguage, string> = {
      typescript: "number",
      csharp: "float",
      dart: "double",
      java: "float",
      python: "float",
      go: "float32",
      kotlin: "Float",
    };
    return floatMap[lang];
  }
  if (format === "double") {
    return mapBasicType("number", lang);
  }

  // email, uri, etc. -> string
  if (["email", "uri", "url", "hostname", "ipv4", "ipv6", "byte", "binary", "password"].includes(format)) {
    return mapBasicType("string", lang);
  }

  // Fallback: use base type
  return mapBasicType(baseType, lang);
}

// Convert field name to the convention of each language
function formatFieldName(name: string, lang: DtoLanguage): string {
  switch (lang) {
    case "typescript":
    case "java":
    case "kotlin":
    case "dart":
      return name; // camelCase (keep as-is from swagger)
    case "csharp":
      // PascalCase for C#
      return name.charAt(0).toUpperCase() + name.slice(1);
    case "python":
      // snake_case
      return name.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
    case "go":
      // PascalCase (exported)
      return name.charAt(0).toUpperCase() + name.slice(1);
  }
}

// Generate DTO code for a single schema
function generateSchemaDto(
  schemaName: string,
  fields: Record<string, string>,
  lang: DtoLanguage
): string {
  const entries = Object.entries(fields);

  switch (lang) {
    case "typescript":
      return generateTypeScript(schemaName, entries);
    case "csharp":
      return generateCSharp(schemaName, entries);
    case "dart":
      return generateDart(schemaName, entries);
    case "java":
      return generateJava(schemaName, entries);
    case "python":
      return generatePython(schemaName, entries);
    case "go":
      return generateGo(schemaName, entries);
    case "kotlin":
      return generateKotlin(schemaName, entries);
  }
}

function generateTypeScript(
  name: string,
  fields: [string, string][]
): string {
  const lines = fields.map(([field, type]) => {
    // Handle enums as union types
    if (type.startsWith("enum(")) {
      const values = type.slice(5, -1).split(", ");
      const union = values.map((v) => `"${v}"`).join(" | ");
      return `  ${field}?: ${union};`;
    }
    const mapped = mapType(type, "typescript");
    return `  ${field}?: ${mapped};`;
  });

  return `export interface ${name} {\n${lines.join("\n")}\n}`;
}

function generateCSharp(
  name: string,
  fields: [string, string][]
): string {
  const lines = fields.map(([field, type]) => {
    const mapped = mapType(type, "csharp");
    const propName = formatFieldName(field, "csharp");
    return `    public ${mapped}? ${propName} { get; set; }`;
  });

  return `public class ${name}\n{\n${lines.join("\n")}\n}`;
}

function generateDart(
  name: string,
  fields: [string, string][]
): string {
  const fieldLines = fields.map(([field, type]) => {
    const mapped = mapType(type, "dart");
    return `  final ${mapped}? ${field};`;
  });

  const constructorParams = fields
    .map(([field]) => `    this.${field},`)
    .join("\n");

  const factoryFields = fields
    .map(([field, type]) => {
      const mapped = mapType(type, "dart");
      if (mapped.startsWith("List<") && /^[A-Z]/.test(type.replace("[]", ""))) {
        const inner = type.replace("[]", "");
        return `      ${field}: (json['${field}'] as List?)?.map((e) => ${inner}.fromJson(e)).toList(),`;
      }
      if (/^[A-Z]/.test(type) && !type.endsWith("[]") && !type.startsWith("Map")) {
        return `      ${field}: json['${field}'] != null ? ${type}.fromJson(json['${field}']) : null,`;
      }
      return `      ${field}: json['${field}'],`;
    })
    .join("\n");

  const toJsonFields = fields
    .map(([field, type]) => {
      if (type.endsWith("[]") && /^[A-Z]/.test(type.replace("[]", ""))) {
        return `      '${field}': ${field}?.map((e) => e.toJson()).toList(),`;
      }
      if (/^[A-Z]/.test(type) && !type.endsWith("[]") && !type.startsWith("enum")) {
        return `      '${field}': ${field}?.toJson(),`;
      }
      return `      '${field}': ${field},`;
    })
    .join("\n");

  return [
    `class ${name} {`,
    fieldLines.join("\n"),
    "",
    `  ${name}({`,
    constructorParams,
    "  });",
    "",
    `  factory ${name}.fromJson(Map<String, dynamic> json) {`,
    `    return ${name}(`,
    factoryFields,
    "    );",
    "  }",
    "",
    "  Map<String, dynamic> toJson() {",
    "    return {",
    toJsonFields,
    "    };",
    "  }",
    "}",
  ].join("\n");
}

function generateJava(
  name: string,
  fields: [string, string][]
): string {
  const fieldLines = fields.map(([field, type]) => {
    const mapped = mapType(type, "java");
    return `    private ${mapped} ${field};`;
  });

  const methods = fields.flatMap(([field, type]) => {
    const mapped = mapType(type, "java");
    const cap = field.charAt(0).toUpperCase() + field.slice(1);
    return [
      "",
      `    public ${mapped} get${cap}() { return ${field}; }`,
      `    public void set${cap}(${mapped} ${field}) { this.${field} = ${field}; }`,
    ];
  });

  return [
    `public class ${name} {`,
    fieldLines.join("\n"),
    methods.join("\n"),
    "}",
  ].join("\n");
}

function generatePython(
  name: string,
  fields: [string, string][]
): string {
  const fieldLines = fields.map(([field, type]) => {
    const pyName = formatFieldName(field, "python");
    const mapped = mapType(type, "python");
    return `    ${pyName}: ${mapped} | None = None`;
  });

  return [
    `@dataclass`,
    `class ${name}:`,
    ...(fieldLines.length > 0
      ? fieldLines
      : ["    pass"]),
  ].join("\n");
}

function generateGo(
  name: string,
  fields: [string, string][]
): string {
  const fieldLines = fields.map(([field, type]) => {
    const goName = formatFieldName(field, "go");
    const mapped = mapType(type, "go");
    // Pointer type for optional
    const pointer = mapped.startsWith("[]") || mapped.startsWith("map") ? mapped : `*${mapped}`;
    return `\t${goName} ${pointer} \`json:"${field},omitempty"\``;
  });

  return `type ${name} struct {\n${fieldLines.join("\n")}\n}`;
}

function generateKotlin(
  name: string,
  fields: [string, string][]
): string {
  const fieldLines = fields.map(([field, type]) => {
    const mapped = mapType(type, "kotlin");
    return `    val ${field}: ${mapped}? = null,`;
  });

  if (fieldLines.length === 0) {
    return `data class ${name}()`;
  }

  return `data class ${name}(\n${fieldLines.join("\n")}\n)`;
}

// Generate all DTOs for a given language
export function generateDtos(
  schemas: Record<string, SchemaObject>,
  schemaNames: string[],
  lang: DtoLanguage
): string {
  const allSchemas = schemas;
  const parts: string[] = [];

  // Add language-specific headers
  switch (lang) {
    case "python":
      parts.push("from dataclasses import dataclass\nfrom datetime import datetime\nfrom typing import Any\nfrom uuid import UUID\n");
      break;
    case "java":
      parts.push("import java.time.LocalDateTime;\nimport java.util.List;\nimport java.util.Map;\nimport java.util.UUID;\n");
      break;
    case "go":
      parts.push('import "time"\n');
      break;
    case "kotlin":
      parts.push("import java.time.LocalDateTime\nimport java.util.UUID\n");
      break;
  }

  for (const schemaName of schemaNames) {
    const schemaDef = allSchemas[schemaName];
    if (!schemaDef) continue;

    const simplified = simplifySchema(
      schemaDef,
      allSchemas as Record<string, SchemaObject>
    );

    if (Object.keys(simplified).length === 0) continue;

    const dto = generateSchemaDto(schemaName, simplified, lang);
    parts.push(dto);
  }

  return parts.join("\n\n");
}

// Collect all schema names used by selected endpoints
export function collectUsedSchemas(
  endpoints: Record<string, { body?: string; response?: string }[]>,
  allSchemas: Record<string, SchemaObject>
): string[] {
  const used = new Set<string>();

  for (const eps of Object.values(endpoints)) {
    for (const ep of eps) {
      if (ep.body) {
        const clean = ep.body.replace("[]", "");
        if (allSchemas[clean]) used.add(clean);
      }
      if (ep.response) {
        const clean = ep.response.replace("[]", "");
        if (allSchemas[clean]) used.add(clean);
      }
    }
  }

  // Recursively find dependent schemas
  let prevSize = 0;
  while (used.size !== prevSize) {
    prevSize = used.size;
    for (const name of Array.from(used)) {
      const schema = allSchemas[name];
      if (!schema) continue;
      findRefs(schema, allSchemas, used);
    }
  }

  return Array.from(used).sort();
}

function findRefs(
  schema: SchemaObject,
  allSchemas: Record<string, SchemaObject>,
  used: Set<string>
): void {
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    if (name && allSchemas[name]) used.add(name);
  }
  if (schema.items) {
    findRefs(schema.items, allSchemas, used);
  }
  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      findRefs(prop, allSchemas, used);
    }
  }
  if (schema.allOf) {
    for (const item of schema.allOf) {
      findRefs(item, allSchemas, used);
    }
  }
  if (schema.oneOf) {
    for (const item of schema.oneOf) {
      findRefs(item, allSchemas, used);
    }
  }
  if (schema.anyOf) {
    for (const item of schema.anyOf) {
      findRefs(item, allSchemas, used);
    }
  }
}
