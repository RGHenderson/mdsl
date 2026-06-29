import { toJSONSchema } from "zod/v4";
import {
  MDSL,
  type MdslDocument,
  type MdslNode,
  type MdslKind,
  type Diagnostic,
} from "../schema/types.js";

export function buildJsonSchema(doc: MdslDocument<unknown>): object {
  return toJSONSchema(doc.schema) as object;
}

/** Builds a JSON Schema with mapping hints injected into field descriptions */
export function buildLlmJsonSchema(doc: MdslDocument<unknown>): object {
  const base = toJSONSchema(doc.schema) as Record<string, unknown>;
  const hints = collectMappingHints(doc[MDSL].fields, "");
  return injectHints(base, hints);
}

function injectHints(
  schema: Record<string, unknown>,
  hints: Record<string, string>,
): Record<string, unknown> {
  if (schema.type !== "object" || !schema.properties) return schema;
  const props = schema.properties as Record<string, Record<string, unknown>>;
  const patched: Record<string, Record<string, unknown>> = {};

  for (const [key, propSchema] of Object.entries(props)) {
    const hint = hints[key];
    patched[key] = hint
      ? {
          ...propSchema,
          description: hint + (propSchema.description ? ` — ${propSchema.description}` : ""),
        }
      : propSchema;
  }

  return { ...schema, properties: patched };
}

function hintForNode(node: MdslNode): string {
  return collectMappingHints({ _: node }, "")["_"] ?? "";
}

export function collectMappingHints(
  fields: Record<string, MdslNode>,
  prefix: string,
): Record<string, string> {
  const hints: Record<string, string> = {};

  for (const [key, node] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const meta = node[MDSL] as MdslKind;

    switch (meta.kind) {
      case "frontmatter":
        hints[path] = "Frontmatter: YAML block at the top of the document";
        break;
      case "section": {
        const label = typeof meta.heading === "string" ? meta.heading : meta.heading.toString();
        hints[path] = `Section: ${"#".repeat(meta.depth)} ${label} heading`;
        Object.assign(hints, collectMappingHints(meta.fields, path));
        break;
      }
      case "repeat": {
        const label = typeof meta.heading === "string" ? meta.heading : meta.heading.toString();
        hints[path] =
          `Repeated section: each ${"#".repeat(meta.depth)} ${label} heading becomes one array item`;
        break;
      }
      case "prose":
        hints[path] = "Prose: paragraph text in the containing section";
        break;
      case "codeBlock":
        hints[path] = `Code block${meta.lang ? ` (language: ${meta.lang})` : ""}`;
        break;
      case "list":
        hints[path] = meta.ordered ? "Ordered (numbered) list items" : "Unordered list items";
        break;
      case "codeBlocks":
        hints[path] = `All code blocks${meta.lang ? ` (language: ${meta.lang})` : ""} as an array`;
        break;
      case "image":
        hints[path] = "Markdown image — { alt, url, title? }";
        break;
      case "table":
        hints[path] = "GFM table rows";
        break;
      case "optional":
        hints[path] = `Optional: ${hintForNode(meta.inner)}`;
        break;
      case "defaultValue":
        hints[path] = `Default "${String(meta.fallback)}": ${hintForNode(meta.inner)}`;
        break;
      case "compose":
        hints[path] = "Composed: first matching extractor wins";
        break;
      case "blockquote":
        hints[path] = "Blockquote (> lines)";
        break;
      case "rule":
        hints[path] = `${meta.name}: ${hintForNode(meta.inner)}`;
        break;
    }
  }

  return hints;
}

export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return "No diagnostics.";
  return diagnostics
    .map((d) => {
      const loc = `Line ${d.mdLocation.line}, col ${d.mdLocation.column}`;
      const sev = d.severity.toUpperCase();
      return `[${sev}] ${loc}: ${d.message} (json: ${d.jsonPath || "<root>"}, code: ${d.code})`;
    })
    .join("\n");
}
