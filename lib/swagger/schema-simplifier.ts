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
