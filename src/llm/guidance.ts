import * as z from "zod";
import type { ZodRawShape } from "zod";

const {
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodArray,
  ZodObject,
  ZodOptional,
  ZodDefault,
  ZodEnum,
  ZodLiteral,
} = z;
import {
  MDSL,
  type MdslDocument,
  type MdslNode,
  type MdslKind,
  type LlmGuide,
} from "../schema/types.js";
import { buildJsonSchema, buildLlmJsonSchema, collectMappingHints } from "./json-schema.js";

// ── generateExampleData ───────────────────────────────────────────────────────

export function generateExampleData(schema: z.ZodType): unknown {
  if (schema instanceof ZodOptional) return generateExampleData(schema.unwrap() as z.ZodType);
  if (schema instanceof ZodDefault) return generateExampleData(schema._def.innerType as z.ZodType);

  if (schema instanceof ZodString) {
    return schema.description ?? "example string";
  }
  if (schema instanceof ZodNumber) {
    return 42;
  }
  if (schema instanceof ZodBoolean) {
    return true;
  }
  if (schema instanceof ZodEnum) {
    const options = schema.options as unknown[];
    return options[0] ?? "value";
  }
  if (schema instanceof ZodLiteral) {
    const vals = schema._def.values as unknown[];
    return vals[0];
  }
  if (schema instanceof ZodArray) {
    return [generateExampleData(schema.element as z.ZodType)];
  }
  if (schema instanceof ZodObject) {
    const shape = schema.shape as ZodRawShape;
    return Object.fromEntries(
      Object.entries(shape).map(([k, v]) => [k, generateExampleData(v as z.ZodType)]),
    );
  }
  return "value";
}

// ── Node-level description helpers ────────────────────────────────────────────

function describeNode(key: string, node: MdslNode, depth: number): string {
  const meta = node[MDSL] as MdslKind;
  const hashes = "#".repeat(depth + 2);
  const pad = "  ".repeat(depth);

  switch (meta.kind) {
    case "frontmatter": {
      const shape = (meta.schema as z.ZodObject<ZodRawShape>).shape;
      const fields = Object.entries(shape)
        .map(([k, v]) => {
          const desc = (v as z.ZodType).description;
          return `${pad}  - \`${k}\`${desc ? `: ${desc}` : ""}`;
        })
        .join("\n");
      return `${pad}- **Frontmatter** (YAML at top of document):\n${fields}`;
    }

    case "heading":
      return `${pad}- **${key}**: Heading at depth ${meta.depth} (#{${meta.depth}}).`;

    case "section": {
      const label = typeof meta.heading === "string" ? meta.heading : meta.heading.toString();
      const parts = [
        `${hashes} Section: \`${label}\``,
        "",
        `A depth-${meta.depth} heading with text "${label}".`,
      ];
      for (const [k, child] of Object.entries(meta.fields)) {
        parts.push("", describeNode(k, child, depth + 1));
      }
      return parts.join("\n");
    }

    case "repeat": {
      const label = typeof meta.heading === "string" ? meta.heading : meta.heading.toString();
      return `${pad}- **${key}**: Repeated \`${"#".repeat(meta.depth)} ${label}\` sections → array.`;
    }

    case "prose":
      return `${pad}- **${key}**: Free-form prose paragraphs.`;

    case "codeBlock":
      return `${pad}- **${key}**: Fenced code block${meta.lang ? ` (\`${meta.lang}\`)` : ""}.`;

    case "codeBlocks":
      return `${pad}- **${key}**: All fenced code blocks${meta.lang ? ` (\`${meta.lang}\`)` : ""} in the section as an array.`;

    case "image":
      return `${pad}- **${key}**: Markdown image (\`![alt](url)\`), captured as \`{ alt, url, title? }\`.`;

    case "list": {
      const desc = meta.itemSchema.description;
      const listType = meta.ordered ? "Ordered (numbered)" : "Unordered";
      return `${pad}- **${key}**: ${listType} list.${desc ? ` Items: ${desc}` : ""}`;
    }

    case "table": {
      const desc = meta.rowSchema.description;
      return `${pad}- **${key}**: GFM table.${desc ? ` Rows: ${desc}` : ""}`;
    }

    case "optional":
      return `${pad}- **${key}** *(optional)*: ${describeNode("", meta.inner, depth).trimStart()}`;

    case "defaultValue":
      return `${pad}- **${key}** *(default: ${JSON.stringify(meta.fallback)})*: ${describeNode("", meta.inner, depth).trimStart()}`;

    case "blockquote":
      return `${pad}- **${key}**: Blockquote (\`> …\` lines).`;

    case "compose":
      return `${pad}- **${key}**: First of [${meta.nodes.map((_, i) => `option ${i + 1}`).join(", ")}] that matches.`;

    case "rule":
      return describeNode(key, meta.inner, depth).replace(/^\s*[-*]?\s*\*\*[^*]+\*\*/, (m) =>
        m.replace(/\*\*[^*]+\*\*/, `**${key}** *(rule: ${meta.name})*`),
      );

    default:
      return "";
  }
}

function exampleNode(node: MdslNode): string {
  const meta = node[MDSL] as MdslKind;

  switch (meta.kind) {
    case "frontmatter": {
      const shape = (meta.schema as z.ZodObject<ZodRawShape>).shape;
      const entries = Object.entries(shape)
        .map(([k, v]) => {
          const ex = generateExampleData(v as z.ZodType);
          return `${k}: ${JSON.stringify(ex)}`;
        })
        .join("\n");
      return `---\n${entries}\n---`;
    }

    case "heading":
      return `# ${generateExampleData(z.string())}`;

    case "section": {
      const hashes = "#".repeat(meta.depth);
      const label = typeof meta.heading === "string" ? meta.heading : "Section";
      const parts = [`${hashes} ${label}`];
      for (const child of Object.values(meta.fields)) {
        parts.push("", exampleNode(child));
      }
      return parts.join("\n");
    }

    case "repeat": {
      const hashes = "#".repeat(meta.depth);
      const label = typeof meta.heading === "string" ? meta.heading : "Item";
      const parts = [`${hashes} ${label}`];
      for (const child of Object.values(meta.fields)) {
        parts.push("", exampleNode(child));
      }
      return parts.join("\n");
    }

    case "prose":
      return "Example prose content goes here.";

    case "codeBlock":
      return `\`\`\`${meta.lang ?? ""}\n// example code\n\`\`\``;

    case "codeBlocks":
      return `\`\`\`${meta.lang ?? ""}\n// first block\n\`\`\`\n\n\`\`\`${meta.lang ?? ""}\n// second block\n\`\`\``;

    case "image":
      return `![Example image](https://example.com/image.png)`;

    case "list": {
      const item = generateExampleData(meta.itemSchema);
      const itemStr = typeof item === "string" ? item : JSON.stringify(item);
      return meta.ordered ? `1. ${itemStr}\n2. Second item` : `- ${itemStr}\n- Second item`;
    }

    case "table": {
      const row = generateExampleData(meta.rowSchema);
      if (typeof row !== "object" || row === null || Array.isArray(row)) return "";
      const exampleRow = row as Record<string, unknown>;
      const headers = Object.keys(exampleRow);
      if (headers.length === 0) return "";
      const vals = headers.map((h) => String(exampleRow[h] ?? ""));
      return `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n| ${vals.join(" | ")} |`;
    }

    case "optional":
      return exampleNode(meta.inner);

    case "defaultValue":
      return exampleNode(meta.inner);

    case "blockquote":
      return "> Example blockquote content.";

    case "compose":
      return meta.nodes[0] ? exampleNode(meta.nodes[0]) : "";

    case "rule":
      return exampleNode(meta.inner);

    default:
      return "";
  }
}

function templateNode(node: MdslNode): string {
  const meta = node[MDSL] as MdslKind;

  switch (meta.kind) {
    case "frontmatter": {
      const shape = (meta.schema as z.ZodObject<ZodRawShape>).shape;
      const entries = Object.entries(shape)
        .map(([k, v]) => {
          const desc = (v as z.ZodType).description ?? k;
          return `${k}: <${desc}>`;
        })
        .join("\n");
      return `---\n${entries}\n---`;
    }

    case "section": {
      const hashes = "#".repeat(meta.depth);
      const label = typeof meta.heading === "string" ? meta.heading : "Section";
      const parts = [`${hashes} ${label}`];
      for (const child of Object.values(meta.fields)) {
        parts.push("", templateNode(child));
      }
      return parts.join("\n");
    }

    case "repeat": {
      const hashes = "#".repeat(meta.depth);
      const label = typeof meta.heading === "string" ? meta.heading : "Item";
      const parts = [`${hashes} ${label} (repeat for each item)`];
      for (const child of Object.values(meta.fields)) {
        parts.push("", templateNode(child));
      }
      return parts.join("\n");
    }

    case "prose":
      return "<prose>";

    case "codeBlock":
      return `\`\`\`${meta.lang ?? ""}\n<code>\n\`\`\``;

    case "codeBlocks":
      return `\`\`\`${meta.lang ?? ""}\n<code>\n\`\`\``;

    case "image":
      return `![<alt text>](<url>)`;

    case "list":
      return meta.ordered ? "1. <item>" : "- <item>";

    case "table": {
      const shape = (meta.rowSchema as z.ZodObject<ZodRawShape>).shape ?? {};
      const headers = Object.keys(shape);
      if (headers.length === 0) return "| <col> |\n| --- |\n| <value> |";
      return `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n| ${headers.map((h) => `<${h}>`).join(" | ")} |`;
    }

    case "optional":
      return `<!-- optional -->\n${templateNode(meta.inner)}`;

    case "defaultValue":
      return templateNode(meta.inner);

    case "blockquote":
      return "> <blockquote content>";

    case "compose":
      return meta.nodes[0] ? templateNode(meta.nodes[0]) : "";

    case "rule":
      return templateNode(meta.inner);

    default:
      return "";
  }
}

// ── Public builders ───────────────────────────────────────────────────────────

export function buildGuidance(doc: MdslDocument<unknown>): string {
  const meta = doc[MDSL];
  const lines = [
    "# Document Structure Guide",
    "",
    "This document describes the expected structure of the markdown document.",
    "",
    "## Fields",
    "",
  ];

  for (const [key, node] of Object.entries(meta.fields)) {
    lines.push(describeNode(key, node, 0), "");
  }

  return lines.join("\n");
}

export function buildExampleMarkdown(doc: MdslDocument<unknown>): string {
  const meta = doc[MDSL];
  const parts: string[] = [];
  for (const node of Object.values(meta.fields)) {
    const ex = exampleNode(node);
    if (ex) parts.push(ex);
  }
  return parts.join("\n\n") + "\n";
}

export function buildMarkdownTemplate(doc: MdslDocument<unknown>): string {
  const meta = doc[MDSL];
  const parts: string[] = [];
  for (const node of Object.values(meta.fields)) {
    const t = templateNode(node);
    if (t) parts.push(t);
  }
  return parts.join("\n\n") + "\n";
}

export function buildLlmGuide(doc: MdslDocument<unknown>): LlmGuide {
  const exampleJson = generateExampleData(doc.schema);
  const exampleMarkdown = buildExampleMarkdown(doc);
  const template = buildMarkdownTemplate(doc);
  const guidance = buildGuidance(doc);
  const jsonSchema = buildJsonSchema(doc);
  const llmJsonSchema = buildLlmJsonSchema(doc);

  const systemPrompt = [
    "# MDSL Document Instructions",
    "",
    "You must produce a markdown document that strictly follows the structure below.",
    "",
    "## Structure",
    "",
    guidance,
    "",
    "## Template",
    "",
    "```markdown",
    template,
    "```",
    "",
    "## Example",
    "",
    "```markdown",
    exampleMarkdown,
    "```",
    "",
    "## Validation",
    "",
    "The document will be parsed and validated against this JSON Schema:",
    "",
    "```json",
    JSON.stringify(jsonSchema, null, 2),
    "```",
  ].join("\n");

  return {
    jsonSchema,
    llmJsonSchema,
    exampleJson,
    exampleMarkdown,
    template,
    guidance,
    systemPrompt,
    mappingHints: collectMappingHints(doc[MDSL].fields, ""),
    instructions: systemPrompt,
  };
}
