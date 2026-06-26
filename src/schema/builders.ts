import {
  z,
  type ZodType,
  type ZodObject,
  type ZodRawShape,
  type ZodOptional,
  type ZodDefault,
  type ZodArray,
  type ZodString,
} from "zod";
import {
  MDSL,
  type MdslDocument,
  type MdslNode,
  type MdslKind,
  type ParseOptions,
  type InferMdsl,
} from "./types.js";
import { parseMarkdown, validateData } from "../parse/parser.js";
import { serializeDocument } from "../serialize/serializer.js";
import { buildJsonSchema, buildLlmJsonSchema, formatDiagnostics } from "../llm/json-schema.js";
import {
  buildGuidance,
  buildExampleMarkdown,
  buildMarkdownTemplate,
  buildLlmGuide,
} from "../llm/guidance.js";

type FieldsToShape<F extends Record<string, MdslNode>> = {
  [K in keyof F]: F[K] extends MdslNode<infer S> ? S : ZodType;
};

// ── Primitive builders ────────────────────────────────────────────────────────

export function frontmatter<T extends ZodRawShape>(schema: ZodObject<T>): MdslNode<ZodObject<T>> {
  return { [MDSL]: { kind: "frontmatter", schema }, schema };
}

export function section<F extends Record<string, MdslNode>>(
  sectionHeading: string | RegExp,
  fields: F,
  depth = 2,
): MdslNode<ZodObject<FieldsToShape<F>>> {
  const shape = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.schema]),
  ) as ZodRawShape;
  const schema = z.object(shape) as ZodObject<FieldsToShape<F>>;
  return { [MDSL]: { kind: "section", heading: sectionHeading, depth, fields }, schema };
}

export function prose(): MdslNode<ZodString> {
  return { [MDSL]: { kind: "prose" }, schema: z.string() };
}

export function codeBlock(lang?: string): MdslNode<ZodString> {
  return { [MDSL]: { kind: "codeBlock", lang: lang as string | undefined }, schema: z.string() };
}

export function list<T extends ZodType>(itemSchema: T): MdslNode<ZodArray<T>> {
  return { [MDSL]: { kind: "list", itemSchema }, schema: z.array(itemSchema) };
}

export function table<T extends ZodType>(rowSchema: T): MdslNode<ZodArray<T>> {
  return { [MDSL]: { kind: "table", rowSchema }, schema: z.array(rowSchema) };
}

// ── Mapping wrappers ──────────────────────────────────────────────────────────

export function optional<S extends ZodType>(node: MdslNode<S>): MdslNode<ZodOptional<S>> {
  return { [MDSL]: { kind: "optional", inner: node }, schema: node.schema.optional() };
}

export function defaultValue<S extends ZodType, T>(
  node: MdslNode<S>,
  fallback: T,
): MdslNode<ZodDefault<S>> {
  return {
    [MDSL]: { kind: "defaultValue", inner: node, fallback },
    schema: node.schema.default(fallback as Parameters<typeof node.schema.default>[0]),
  };
}

export function compose<S extends ZodType>(
  ...nodes: [MdslNode<S>, MdslNode, ...MdslNode[]]
): MdslNode<S> {
  return { [MDSL]: { kind: "compose", nodes }, schema: nodes[0].schema };
}

export function heading(depth = 1): MdslNode<ZodString> {
  return { [MDSL]: { kind: "heading", depth }, schema: z.string() };
}

export function listItems(): MdslNode<ZodArray<ZodString>> {
  return list(z.string());
}

export type RepeatOptions = {
  /** When set, the repeat heading text is stored on each item under this field name */
  nameField?: string;
};

/** Extract a repeated heading as an array of objects */
export function repeat<F extends Record<string, MdslNode>>(
  sectionHeading: string | RegExp,
  fields: F,
  depth = 2,
  options?: RepeatOptions,
): MdslNode<ZodArray<ZodObject<ZodRawShape>>> {
  const nameField = options?.nameField;
  const shape: Record<string, ZodType> = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.schema]),
  );
  if (nameField) {
    shape[nameField] = z.string();
  }
  const itemSchema = z.object(shape) as ZodObject<FieldsToShape<F>>;
  const kind: MdslKind = nameField
    ? { kind: "repeat", heading: sectionHeading, depth, fields, nameField }
    : { kind: "repeat", heading: sectionHeading, depth, fields };
  return {
    [MDSL]: kind,
    schema: z.array(itemSchema),
  };
}

// ── Document builder ──────────────────────────────────────────────────────────

export function document<Fields extends Record<string, MdslNode>>(
  fields: Fields,
): MdslDocument<{ [K in keyof Fields]: Fields[K] extends MdslNode<infer S> ? z.infer<S> : never }> {
  type Model = { [K in keyof Fields]: Fields[K] extends MdslNode<infer S> ? z.infer<S> : never };

  const shape = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.schema]),
  ) as ZodRawShape;
  const schema = z.object(shape) as unknown as ZodType<Model>;

  const doc: MdslDocument<Model> = {
    [MDSL]: { kind: "document", fields },
    schema,

    parse(markdown: string, options?: ParseOptions) {
      return parseMarkdown(markdown, doc, options);
    },

    validate(data: unknown) {
      return validateData(data, doc);
    },

    serialize(data: Model) {
      return serializeDocument(data, doc);
    },

    toJsonSchema() {
      return buildJsonSchema(doc);
    },

    toLlmJsonSchema() {
      return buildLlmJsonSchema(doc);
    },

    toMarkdownTemplate() {
      return buildMarkdownTemplate(doc);
    },

    toGuidance() {
      return buildGuidance(doc);
    },

    toLlmGuide() {
      return buildLlmGuide(doc);
    },

    toExampleMarkdown() {
      return buildExampleMarkdown(doc);
    },
  };

  return doc;
}

// ── Type helpers ──────────────────────────────────────────────────────────────

export type { InferMdsl as infer };
export { formatDiagnostics };
