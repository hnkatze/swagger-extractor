import type { SchemaObject } from "@/lib/types/swagger";

/**
 * Simplify a schema to { field: type } format
 * Ported from Python: simplify_schema()
 */
export function simplifySchema(
  schemaDef: SchemaObject,
  allSchemas: Record<string, SchemaObject>,
  processed: Set<string> = new Set()
): Record<string, string> {
  const result: Record<string, string> = {};

  // Handle allOf, oneOf, anyOf
  if (schemaDef.allOf) {
    for (const item of schemaDef.allOf) {
      if (item.$ref) {
        const refName = item.$ref.split("/").pop();
        if (refName && allSchemas[refName] && !processed.has(refName)) {
          processed.add(refName);
          Object.assign(result, simplifySchema(allSchemas[refName], allSchemas, processed));
        }
      } else {
        Object.assign(result, simplifySchema(item, allSchemas, processed));
      }
    }
    return result;
  }

  const properties = schemaDef.properties || {};

  for (const [propName, propDef] of Object.entries(properties)) {
    if (propDef.$ref) {
      // Reference to another schema
      result[propName] = propDef.$ref.split("/").pop() || "object";
    } else if (propDef.type === "array") {
      // Array type
      if (propDef.items) {
        if (propDef.items.$ref) {
          const refName = propDef.items.$ref.split("/").pop();
          result[propName] = `${refName}[]`;
        } else {
          result[propName] = `${propDef.items.type || "any"}[]`;
        }
      } else {
        result[propName] = "array";
      }
    } else if (propDef.enum) {
      // Enum type
      result[propName] = `enum(${propDef.enum.join(", ")})`;
    } else {
      // Basic type
      let propType = propDef.type || "any";
      if (propDef.format) {
        propType = `${propType}(${propDef.format})`;
      }
      result[propName] = propType;
    }
  }

  return result;
}

/**
 * Recursive type for deeply resolved schema fields.
 * A value is either a plain type string or an object with nested fields.
 */
export interface DeepSchemaField {
  type: string;
  fields?: Record<string, DeepSchemaField>;
  isArray?: boolean;
}

/**
 * Deeply resolve a schema, expanding all $ref references recursively.
 * Unlike simplifySchema which returns flat "DtoName" strings,
 * this returns the full nested structure so you can see what's inside each DTO.
 */
export function resolveSchemaDeep(
  schemaName: string,
  allSchemas: Record<string, SchemaObject>,
  visited: Set<string> = new Set()
): Record<string, DeepSchemaField> | null {
  const cleanName = schemaName.replace("[]", "");
  const schema = allSchemas[cleanName];
  if (!schema) return null;

  return resolveObjectDeep(schema, allSchemas, visited);
}

function resolveObjectDeep(
  schemaDef: SchemaObject,
  allSchemas: Record<string, SchemaObject>,
  visited: Set<string>
): Record<string, DeepSchemaField> {
  const result: Record<string, DeepSchemaField> = {};

  // Handle allOf
  if (schemaDef.allOf) {
    for (const item of schemaDef.allOf) {
      if (item.$ref) {
        const refName = item.$ref.split("/").pop();
        if (refName && allSchemas[refName] && !visited.has(refName)) {
          visited.add(refName);
          Object.assign(result, resolveObjectDeep(allSchemas[refName], allSchemas, visited));
        }
      } else {
        Object.assign(result, resolveObjectDeep(item, allSchemas, visited));
      }
    }
    return result;
  }

  const properties = schemaDef.properties || {};

  for (const [propName, propDef] of Object.entries(properties)) {
    if (propDef.$ref) {
      const refName = propDef.$ref.split("/").pop() || "object";
      if (allSchemas[refName] && !visited.has(refName)) {
        visited.add(refName);
        const nested = resolveObjectDeep(allSchemas[refName], allSchemas, visited);
        result[propName] = { type: refName, fields: Object.keys(nested).length > 0 ? nested : undefined };
      } else {
        result[propName] = { type: refName };
      }
    } else if (propDef.type === "array" && propDef.items) {
      if (propDef.items.$ref) {
        const refName = propDef.items.$ref.split("/").pop() || "object";
        if (allSchemas[refName] && !visited.has(refName)) {
          visited.add(refName);
          const nested = resolveObjectDeep(allSchemas[refName], allSchemas, visited);
          result[propName] = { type: `${refName}[]`, isArray: true, fields: Object.keys(nested).length > 0 ? nested : undefined };
        } else {
          result[propName] = { type: `${refName}[]`, isArray: true };
        }
      } else {
        result[propName] = { type: `${propDef.items.type || "any"}[]`, isArray: true };
      }
    } else if (propDef.enum) {
      result[propName] = { type: `enum(${propDef.enum.join(", ")})` };
    } else {
      let propType = propDef.type || "any";
      if (propDef.format) {
        propType = `${propType}(${propDef.format})`;
      }
      result[propName] = { type: propType };
    }
  }

  return result;
}
