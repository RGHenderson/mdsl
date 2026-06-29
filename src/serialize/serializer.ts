import { stringify as yamlStringify } from "yaml";
import { MDSL, type MdslDocument, type MdslNode, type MdslKind } from "../schema/types.js";

function serializeNode(value: unknown, node: MdslNode, depth: number): string {
  const meta = node[MDSL] as MdslKind;

  switch (meta.kind) {
    case "frontmatter": {
      const yaml = yamlStringify(value, { lineWidth: 0 }).trimEnd();
      return `---\n${yaml}\n---`;
    }

    case "heading": {
      const hashes = "#".repeat(meta.depth);
      return `${hashes} ${String(value ?? "")}`;
    }

    case "section": {
      if (value == null || typeof value !== "object") return "";
      const obj = value as Record<string, unknown>;
      const headingText =
        meta.nameField && typeof obj[meta.nameField] === "string"
          ? String(obj[meta.nameField])
          : typeof meta.heading === "string"
            ? meta.heading
            : String(meta.heading).replace(/^\/|\/[gimsuy]*$/g, "");
      const hashes = "#".repeat(meta.depth);
      const parts: string[] = [`${hashes} ${headingText}`];
      for (const [key, fieldNode] of Object.entries(meta.fields)) {
        if (key === meta.nameField) continue;
        const fieldStr = serializeNode(obj[key], fieldNode, depth + 1);
        if (fieldStr) parts.push(fieldStr);
      }
      return parts.join("\n\n");
    }

    case "prose":
      return typeof value === "string" ? value : "";

    case "codeBlock": {
      const lang = meta.lang ?? "";
      return `\`\`\`${lang}\n${String(value ?? "")}\n\`\`\``;
    }

    case "list": {
      const items = Array.isArray(value) ? value : [];
      if (items.length === 0) return "";
      return items
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            return `- ${JSON.stringify(item)}`;
          }
          return `- ${String(item)}`;
        })
        .join("\n");
    }

    case "table": {
      const rows = Array.isArray(value) ? value : [];
      if (rows.length === 0) return "";
      const firstRow = rows[0] as Record<string, unknown>;
      const headers = Object.keys(firstRow ?? {});
      const header = `| ${headers.join(" | ")} |`;
      const separator = `| ${headers.map(() => "---").join(" | ")} |`;
      const dataRows = rows.map((row) => {
        const r = row as Record<string, unknown>;
        return `| ${headers.map((h) => String(r[h] ?? "")).join(" | ")} |`;
      });
      return [header, separator, ...dataRows].join("\n");
    }

    case "repeat": {
      const items = Array.isArray(value) ? value : [];
      const hashes = "#".repeat(meta.depth);
      const defaultLabel =
        typeof meta.heading === "string"
          ? meta.heading
          : String(meta.heading).replace(/^\/|\/[gimsuy]*$/g, "");
      return items
        .map((item) => {
          if (item == null || typeof item !== "object") return "";
          const obj = { ...(item as Record<string, unknown>) };
          const headingLabel =
            meta.nameField && typeof obj[meta.nameField] === "string"
              ? String(obj[meta.nameField])
              : defaultLabel;
          if (meta.nameField) delete obj[meta.nameField];
          const parts: string[] = [`${hashes} ${headingLabel}`];
          for (const [key, fieldNode] of Object.entries(meta.fields)) {
            const fieldStr = serializeNode(obj[key], fieldNode, depth + 1);
            if (fieldStr) parts.push(fieldStr);
          }
          return parts.join("\n\n");
        })
        .join("\n\n");
    }

    case "optional":
      return value === undefined ? "" : serializeNode(value, meta.inner, depth);

    case "defaultValue":
      return serializeNode(value, meta.inner, depth);

    case "blockquote": {
      const text = typeof value === "string" ? value : "";
      if (!text) return "";
      return text
        .split("\n")
        .map((line) => (line === "" ? ">" : `> ${line}`))
        .join("\n");
    }

    case "compose":
      return meta.nodes[0] ? serializeNode(value, meta.nodes[0], depth) : "";

    case "rule":
      return serializeNode(value, meta.inner, depth);

    default:
      return "";
  }
}

export function serializeDocument<T>(data: T, doc: MdslDocument<T>): string {
  const meta = doc[MDSL];
  const obj = data as Record<string, unknown>;
  const parts: string[] = [];

  for (const [key, node] of Object.entries(meta.fields)) {
    const value = obj[key];
    const serialized = serializeNode(value, node, 1);
    if (serialized) parts.push(serialized);
  }

  return parts.join("\n\n") + "\n";
}
