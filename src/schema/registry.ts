import type { Root } from "mdast";
import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { parse as parseYaml } from "yaml";
import { toString as mdastToString } from "mdast-util-to-string";
import type { MdslDocument, ParseResult } from "./types.js";
import { parseAst } from "../parse/parser.js";

export interface MatchContext {
  frontmatter: Record<string, unknown> | undefined;
  headings: string[];
  raw: Root;
}

export type MatchFn = (ctx: MatchContext) => boolean;

export interface RegistryEntry<T> {
  doc: MdslDocument<T>;
  match: MatchFn;
}

export interface Registry {
  register<T>(doc: MdslDocument<T>, match: MatchFn): void;
  parse(markdown: string): ParseResult<unknown> | null;
  detect(markdown: string): MdslDocument<unknown> | null;
}

function buildContext(markdown: string): MatchContext {
  const processor = remark().use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
  const ast = processor.parse(markdown) as Root;

  let frontmatter: Record<string, unknown> | undefined;
  const headings: string[] = [];

  for (const node of ast.children) {
    if (node.type === "yaml") {
      try {
        frontmatter = parseYaml(node.value) as Record<string, unknown>;
      } catch {
        // ignore parse errors during detection
      }
    }
    if (node.type === "heading") {
      headings.push(mdastToString(node).trim());
    }
  }

  return { frontmatter, headings, raw: ast };
}

export function createRegistry(): Registry {
  const entries: RegistryEntry<unknown>[] = [];

  return {
    register<T>(doc: MdslDocument<T>, match: MatchFn) {
      entries.push({ doc: doc as MdslDocument<unknown>, match });
    },

    detect(markdown: string): MdslDocument<unknown> | null {
      const ctx = buildContext(markdown);
      for (const entry of entries) {
        if (entry.match(ctx)) return entry.doc;
      }
      return null;
    },

    parse(markdown: string): ParseResult<unknown> | null {
      const ctx = buildContext(markdown);
      for (const entry of entries) {
        if (entry.match(ctx)) {
          return parseAst(ctx.raw, entry.doc) as ParseResult<unknown>;
        }
      }
      return null;
    },
  };
}
