import type { Root, Heading, Node, Blockquote } from "mdast";
import type { Point } from "unist";
import type { ZodType } from "zod";
import { toString as mdastToString } from "mdast-util-to-string";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfmToMarkdown } from "mdast-util-gfm";
import { parse as parseYaml } from "yaml";
import {
  MDSL,
  DiagnosticCodes,
  type MdslNode,
  type MdslKind,
  type Diagnostic,
} from "../schema/types.js";

export const UNKNOWN_POINT: Point = { line: 1, column: 0, offset: 0 };

function headingMatches(node: Heading, heading: string | RegExp): boolean {
  const text = mdastToString(node).trim();
  if (typeof heading === "string") {
    return text.toLowerCase() === heading.trim().toLowerCase();
  }
  return heading.test(text);
}

function collectSectionChildren(root: Root, startIdx: number, depth: number): Node[] {
  const children = root.children as Node[];
  const result: Node[] = [];
  for (let i = startIdx + 1; i < children.length; i++) {
    const child = children[i];
    if (!child) break;
    if (child.type === "heading" && (child as Heading).depth <= depth) break;
    result.push(child);
  }
  return result;
}

function makeSectionRoot(children: Node[]): Root {
  return { type: "root", children: children as Root["children"] };
}

/**
 * Returns a root containing only the "own" content of a section — nodes
 * before the first child heading. This prevents prose/list/table/codeBlock
 * extractors from bleeding into nested sub-sections.
 */
function ownContentRoot(ast: Root): Root {
  const children = ast.children as Node[];
  const firstHeadingIdx = children.findIndex((n) => n.type === "heading");
  if (firstHeadingIdx === -1) return ast;
  return makeSectionRoot(children.slice(0, firstHeadingIdx));
}

function diag(partial: Omit<Diagnostic, "source">): Diagnostic {
  return { ...partial, source: "markdown" };
}

export function extractHeading(
  ast: Root,
  depth: number,
  jsonPath: string,
  diags: Diagnostic[],
): string | undefined {
  for (const node of ast.children) {
    if (node.type === "heading" && (node as Heading).depth === depth) {
      return mdastToString(node).trim();
    }
  }
  diags.push(
    diag({
      severity: "error",
      message: `Missing required heading at depth ${depth}`,
      code: DiagnosticCodes.MISSING_HEADING,
      mdLocation: UNKNOWN_POINT,
      jsonPath,
      mapping: `heading(${depth})`,
      hint: `Add a ${"#".repeat(depth)} heading to the document.`,
    }),
  );
  return undefined;
}

export function extractFrontmatter(ast: Root, jsonPath: string, diags: Diagnostic[]): unknown {
  for (const node of ast.children) {
    if (node.type === "yaml") {
      try {
        return parseYaml(node.value);
      } catch (error) {
        diags.push(
          diag({
            severity: "error",
            message: `Failed to parse YAML frontmatter: ${String(error)}`,
            code: DiagnosticCodes.FRONTMATTER_PARSE_ERROR,
            mdLocation: node.position?.start ?? UNKNOWN_POINT,
            jsonPath,
            mapping: "frontmatter(...)",
          }),
        );
        return undefined;
      }
    }
  }
  diags.push(
    diag({
      severity: "error",
      message: "Missing required frontmatter block",
      code: DiagnosticCodes.MISSING_FRONTMATTER,
      mdLocation: UNKNOWN_POINT,
      jsonPath,
      mapping: "frontmatter(...)",
    }),
  );
  return undefined;
}

/** Find all heading indices matching title+depth; returns indices into ast.children */
function findSectionIndices(ast: Root, heading: string | RegExp, depth: number): number[] {
  const indices: number[] = [];
  const children = ast.children as Node[];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (!node) continue;
    if (
      node.type === "heading" &&
      (node as Heading).depth === depth &&
      headingMatches(node as Heading, heading)
    ) {
      indices.push(i);
    }
  }
  return indices;
}

export function extractSection(
  ast: Root,
  heading: string | RegExp,
  depth: number,
  jsonPath: string,
  diags: Diagnostic[],
): { children: Node[]; position: Point; headingText: string } | undefined {
  const indices = findSectionIndices(ast, heading, depth);
  const label = typeof heading === "string" ? `"${heading}"` : heading.toString();

  if (indices.length === 0) {
    diags.push({
      severity: "error",
      message: `Missing required section: ${label}`,
      code: DiagnosticCodes.MISSING_SECTION,
      mdLocation: UNKNOWN_POINT,
      jsonPath,
    });
    return undefined;
  }

  if (indices.length > 1) {
    const node = ast.children[indices[0]!]!;
    diags.push({
      severity: "error",
      message: `Ambiguous section: ${label} appears ${indices.length} times at depth ${depth}`,
      code: DiagnosticCodes.AMBIGUOUS_SECTION,
      mdLocation: (node as Node & { position?: { start: Point } }).position?.start ?? UNKNOWN_POINT,
      jsonPath,
    });
    // Still proceed with first match
  }

  const idx = indices[0]!;
  const node = ast.children[idx]!;
  return {
    children: collectSectionChildren(ast, idx, depth),
    position: (node as Node & { position?: { start: Point } }).position?.start ?? UNKNOWN_POINT,
    headingText: mdastToString(node).trim(),
  };
}

/** Collect all occurrences of a heading+depth as separate child arrays */
export function extractRepeatSections(
  ast: Root,
  heading: string | RegExp,
  depth: number,
): Array<{ children: Node[]; position: Point; title: string }> {
  const indices = findSectionIndices(ast, heading, depth);
  return indices.map((idx) => {
    const node = ast.children[idx]!;
    return {
      children: collectSectionChildren(ast, idx, depth),
      position: (node as Node & { position?: { start: Point } }).position?.start ?? UNKNOWN_POINT,
      title: mdastToString(node).trim(),
    };
  });
}

export function extractProse(ast: Root, jsonPath: string, diags: Diagnostic[]): string {
  const paras = (ast.children as Node[]).filter((n) => n.type === "paragraph");
  if (paras.length === 0) {
    diags.push({
      severity: "error",
      message: "Missing required prose content",
      code: DiagnosticCodes.MISSING_PROSE,
      mdLocation: UNKNOWN_POINT,
      jsonPath,
    });
    return "";
  }
  return toMarkdown(makeSectionRoot(paras), { extensions: [gfmToMarkdown()] }).trim();
}

export function extractCodeBlock(
  ast: Root,
  lang: string | undefined,
  jsonPath: string,
  diags: Diagnostic[],
): string | undefined {
  for (const node of ast.children) {
    if (node.type === "code") {
      if (!lang || (node.lang ?? "").toLowerCase() === lang.toLowerCase()) {
        return node.value;
      }
    }
  }
  const label = lang ? `language "${lang}"` : "any language";
  diags.push({
    severity: "error",
    message: `Missing required code block with ${label}`,
    code: DiagnosticCodes.MISSING_CODE_BLOCK,
    mdLocation: UNKNOWN_POINT,
    jsonPath,
  });
  return undefined;
}

export function extractBlockquote(
  ast: Root,
  jsonPath: string,
  diags: Diagnostic[],
): string | undefined {
  for (const node of ast.children as Node[]) {
    if (node.type === "blockquote") {
      return toMarkdown(makeSectionRoot((node as Blockquote).children as Node[]), {
        extensions: [gfmToMarkdown()],
      }).trim();
    }
  }
  diags.push({
    severity: "error",
    message: "Missing required blockquote",
    code: DiagnosticCodes.MISSING_BLOCKQUOTE,
    mdLocation: UNKNOWN_POINT,
    jsonPath,
    mapping: "blockquote()",
  });
  return undefined;
}

export function extractList(
  ast: Root,
  itemSchema: ZodType,
  jsonPath: string,
  diags: Diagnostic[],
  ordered?: boolean,
): unknown[] {
  for (const node of ast.children) {
    if (node.type === "list") {
      if (ordered !== undefined && node.ordered !== ordered) continue;
      return node.children.map((item, idx) => {
        const text = mdastToString(item).trim();
        const itemPath = `${jsonPath}[${idx}]`;
        try {
          const parsed = JSON.parse(text);
          const result = itemSchema.safeParse(parsed);
          if (!result.success) {
            result.error.issues.forEach((issue) => {
              diags.push({
                severity: "error",
                message: issue.message,
                code: DiagnosticCodes.ZOD_VALIDATION,
                mdLocation: item.position?.start ?? UNKNOWN_POINT,
                jsonPath: `${itemPath}.${issue.path.join(".")}`,
              });
            });
          }
          // Return the natural (pre-transform) value so the document-level
          // safeParse can apply Zod transforms exactly once on the right input.
          return parsed;
        } catch {
          const result = itemSchema.safeParse(text);
          if (!result.success) {
            result.error.issues.forEach((issue) => {
              diags.push({
                severity: "error",
                message: issue.message,
                code: DiagnosticCodes.ZOD_VALIDATION,
                mdLocation: item.position?.start ?? UNKNOWN_POINT,
                jsonPath: issue.path.length > 0 ? `${itemPath}.${issue.path.join(".")}` : itemPath,
              });
            });
          }
          return text;
        }
      });
    }
  }
  diags.push({
    severity: "error",
    message: "Missing required list",
    code: DiagnosticCodes.MISSING_LIST,
    mdLocation: UNKNOWN_POINT,
    jsonPath,
  });
  return [];
}

export function extractTable(
  ast: Root,
  rowSchema: ZodType,
  jsonPath: string,
  diags: Diagnostic[],
): unknown[] {
  for (const node of ast.children) {
    if (node.type === "table") {
      const [headerRow, ...dataRows] = node.children;
      if (!headerRow) return [];
      const headers = headerRow.children.map((cell) => mdastToString(cell).trim());
      return dataRows.map((row, rowIdx) => {
        const rowObj: Record<string, string> = {};
        row.children.forEach((cell, colIdx) => {
          const key = headers[colIdx] ?? String(colIdx);
          rowObj[key] = mdastToString(cell).trim();
        });
        const result = rowSchema.safeParse(rowObj);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            diags.push({
              severity: "error",
              message: issue.message,
              code: DiagnosticCodes.ZOD_VALIDATION,
              mdLocation: row.position?.start ?? UNKNOWN_POINT,
              jsonPath: `${jsonPath}[${rowIdx}].${issue.path.join(".")}`,
            });
          });
        }
        // Return natural (pre-transform) rowObj so document-level safeParse
        // applies transforms exactly once.
        return rowObj;
      });
    }
  }
  diags.push({
    severity: "error",
    message: "Missing required table",
    code: DiagnosticCodes.MISSING_TABLE,
    mdLocation: UNKNOWN_POINT,
    jsonPath,
  });
  return [];
}

export function extractNode(
  ast: Root,
  node: MdslNode,
  jsonPath: string,
  diags: Diagnostic[],
): unknown {
  const meta = node[MDSL] as MdslKind;

  switch (meta.kind) {
    case "frontmatter":
      return extractFrontmatter(ast, jsonPath, diags);

    case "heading":
      return extractHeading(ast, meta.depth, jsonPath, diags);

    case "section": {
      const sectionResult = extractSection(ast, meta.heading, meta.depth, jsonPath, diags);
      if (!sectionResult) return undefined;
      const sectionAst = makeSectionRoot(sectionResult.children);
      const result = extractFields(sectionAst, meta.fields, jsonPath, diags);
      if (meta.nameField) {
        (result as Record<string, unknown>)[meta.nameField] = sectionResult.headingText;
      }
      return result;
    }

    case "repeat": {
      const occurrences = extractRepeatSections(ast, meta.heading, meta.depth);
      const minItems = meta.minItems ?? 1;
      if (occurrences.length < minItems) {
        diags.push({
          severity: "error",
          message: `Missing required repeat section: "${String(meta.heading)}"`,
          code: DiagnosticCodes.MISSING_REPEAT_ITEMS,
          mdLocation: UNKNOWN_POINT,
          jsonPath,
        });
        return [];
      }
      return occurrences.map((occ, i) => {
        const sectionAst = makeSectionRoot(occ.children);
        const item = extractFields(sectionAst, meta.fields, `${jsonPath}[${i}]`, diags);
        if (meta.nameField) {
          (item as Record<string, unknown>)[meta.nameField] = occ.title;
        }
        return item;
      });
    }

    case "blockquote":
      return extractBlockquote(ownContentRoot(ast), jsonPath, diags);

    case "prose":
      return extractProse(ownContentRoot(ast), jsonPath, diags);

    case "codeBlock":
      return extractCodeBlock(ownContentRoot(ast), meta.lang, jsonPath, diags);

    case "list":
      return extractList(ownContentRoot(ast), meta.itemSchema, jsonPath, diags, meta.ordered);

    case "table":
      return extractTable(ownContentRoot(ast), meta.rowSchema, jsonPath, diags);

    case "optional": {
      const innerDiags: Diagnostic[] = [];
      const value = extractNode(ast, meta.inner, jsonPath, innerDiags);
      const hasError = innerDiags.some((d) => d.severity === "error");
      if (hasError) return undefined;
      diags.push(...innerDiags);
      return value;
    }

    case "defaultValue": {
      const innerDiags: Diagnostic[] = [];
      const value = extractNode(ast, meta.inner, jsonPath, innerDiags);
      const hasError = innerDiags.some((d) => d.severity === "error");
      if (hasError) return meta.fallback;
      diags.push(...innerDiags);
      return value;
    }

    case "compose": {
      for (const candidate of meta.nodes) {
        const innerDiags: Diagnostic[] = [];
        const value = extractNode(ast, candidate, jsonPath, innerDiags);
        const hasError = innerDiags.some((d) => d.severity === "error");
        if (!hasError) {
          diags.push(...innerDiags);
          return value;
        }
      }
      diags.push({
        severity: "error",
        message: `No matching extractor succeeded for field "${jsonPath}"`,
        code: DiagnosticCodes.COMPOSE_FAILED,
        mdLocation: UNKNOWN_POINT,
        jsonPath,
      });
      return undefined;
    }

    case "rule": {
      const innerDiags: Diagnostic[] = [];
      const value = extractNode(ast, meta.inner, jsonPath, innerDiags);
      // Annotate each diagnostic with the rule name in the mapping field
      for (const d of innerDiags) {
        diags.push({ ...d, mapping: d.mapping ? `${meta.name} > ${d.mapping}` : meta.name });
      }
      return value;
    }

    default:
      return undefined;
  }
}

export function extractFields(
  ast: Root,
  fields: Record<string, MdslNode>,
  parentPath: string,
  diags: Diagnostic[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, node] of Object.entries(fields)) {
    const jsonPath = parentPath ? `${parentPath}.${key}` : key;
    result[key] = extractNode(ast, node, jsonPath, diags);
  }
  return result;
}
