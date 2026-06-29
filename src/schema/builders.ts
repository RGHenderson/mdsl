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
  type ValidatorFn,
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

type WithNameField<
  F extends Record<string, MdslNode>,
  N extends string | undefined,
> = N extends string ? FieldsToShape<F> & { [K in N]: ZodString } : FieldsToShape<F>;

// ── Node factory ─────────────────────────────────────────────────────────────

function makeNode<S extends ZodType>(meta: MdslKind, schema: S): MdslNode<S> {
  const node: MdslNode<S> = {
    [MDSL]: meta,
    schema,
    or(other: MdslNode): MdslNode<S> {
      return makeNode({ kind: "compose", nodes: [node, other] }, schema);
    },
  };
  return node;
}

// ── Primitive builders ────────────────────────────────────────────────────────

export function frontmatter<T extends ZodRawShape>(schema: ZodObject<T>): MdslNode<ZodObject<T>> {
  return makeNode({ kind: "frontmatter", schema }, schema);
}

export function section<
  F extends Record<string, MdslNode>,
  N extends string | undefined = undefined,
>(
  sectionHeading: string | RegExp,
  fields: F,
  depth = 2,
  options?: { nameField?: N },
): MdslNode<ZodObject<WithNameField<F, N>>> {
  const nameField = options?.nameField;
  const shape: Record<string, ZodType> = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.schema]),
  );
  if (nameField) {
    shape[nameField] = z.string();
  }
  const schema = z.object(shape as ZodRawShape) as ZodObject<WithNameField<F, N>>;
  return makeNode(
    nameField
      ? { kind: "section", heading: sectionHeading, depth, fields, nameField }
      : { kind: "section", heading: sectionHeading, depth, fields },
    schema,
  );
}

export function prose(): MdslNode<ZodString> {
  return makeNode({ kind: "prose" }, z.string());
}

export function codeBlock(lang?: string): MdslNode<ZodString> {
  return makeNode({ kind: "codeBlock", lang: lang as string | undefined }, z.string());
}

export function blockquote(): MdslNode<ZodString> {
  return makeNode({ kind: "blockquote" }, z.string());
}

export function list<T extends ZodType>(
  itemSchema: T,
  options?: { ordered?: boolean },
): MdslNode<ZodArray<T>> {
  const meta =
    options?.ordered !== undefined
      ? { kind: "list" as const, itemSchema, ordered: options.ordered }
      : { kind: "list" as const, itemSchema };
  return makeNode(meta, z.array(itemSchema));
}

export function orderedList<T extends ZodType>(itemSchema: T): MdslNode<ZodArray<T>> {
  return list(itemSchema, { ordered: true });
}

export function codeBlocks(lang?: string): MdslNode<ZodArray<ZodString>> {
  return makeNode({ kind: "codeBlocks", lang: lang as string | undefined }, z.array(z.string()));
}

const imageSchema = z.object({
  alt: z.string(),
  url: z.string(),
  title: z.string().optional(),
});

export type ImageValue = z.infer<typeof imageSchema>;

export function image(): MdslNode<typeof imageSchema> {
  return makeNode({ kind: "image" }, imageSchema);
}

export function table<T extends ZodType>(rowSchema: T): MdslNode<ZodArray<T>> {
  return makeNode({ kind: "table", rowSchema }, z.array(rowSchema));
}

// ── Mapping wrappers ──────────────────────────────────────────────────────────

export function optional<S extends ZodType>(node: MdslNode<S>): MdslNode<ZodOptional<S>> {
  return makeNode({ kind: "optional", inner: node }, node.schema.optional());
}

export function defaultValue<S extends ZodType, T>(
  node: MdslNode<S>,
  fallback: T,
): MdslNode<ZodDefault<S>> {
  return makeNode(
    { kind: "defaultValue", inner: node, fallback },
    node.schema.default(fallback as Parameters<typeof node.schema.default>[0]),
  );
}

export function compose<S extends ZodType>(
  ...nodes: [MdslNode<S>, MdslNode, ...MdslNode[]]
): MdslNode<S> {
  return makeNode({ kind: "compose", nodes }, nodes[0].schema);
}

/** Attach a display name to any node for use in diagnostics and LLM guidance */
export function rule<S extends ZodType>(name: string, node: MdslNode<S>): MdslNode<S> {
  return makeNode({ kind: "rule", name, inner: node }, node.schema);
}

export function heading(depth = 1): MdslNode<ZodString> {
  return makeNode({ kind: "heading", depth }, z.string());
}

export function listItems(): MdslNode<ZodArray<ZodString>> {
  return list(z.string());
}

export function title(): MdslNode<ZodString> {
  return heading(1);
}

export type RepeatOptions = {
  /** When set, the repeat heading text is stored on each item under this field name */
  nameField?: string;
  /** Minimum number of occurrences required. Defaults to 1. Set to 0 for zero-or-more. */
  minItems?: number;
};

/** Extract a repeated heading as an array of objects */
export function repeat<
  F extends Record<string, MdslNode>,
  N extends string | undefined = undefined,
>(
  sectionHeading: string | RegExp,
  fields: F,
  depth = 2,
  options?: { nameField?: N; minItems?: number },
): MdslNode<ZodArray<ZodObject<WithNameField<F, N>>>> {
  const nameField = options?.nameField;
  const minItems = options?.minItems;
  const shape: Record<string, ZodType> = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.schema]),
  );
  if (nameField) {
    shape[nameField] = z.string();
  }
  const itemSchema = z.object(shape as ZodRawShape) as ZodObject<WithNameField<F, N>>;
  const kind: MdslKind =
    nameField !== undefined && minItems !== undefined
      ? { kind: "repeat", heading: sectionHeading, depth, fields, nameField, minItems }
      : nameField !== undefined
        ? { kind: "repeat", heading: sectionHeading, depth, fields, nameField }
        : minItems !== undefined
          ? { kind: "repeat", heading: sectionHeading, depth, fields, minItems }
          : { kind: "repeat", heading: sectionHeading, depth, fields };
  return makeNode(kind, z.array(itemSchema));
}

// ── Document builder ──────────────────────────────────────────────────────────

export function document<Fields extends Record<string, MdslNode>>(
  fields: Fields,
  _validators: ValidatorFn<{
    [K in keyof Fields]: Fields[K] extends MdslNode<infer S> ? z.infer<S> : never;
  }>[] = [],
): MdslDocument<{ [K in keyof Fields]: Fields[K] extends MdslNode<infer S> ? z.infer<S> : never }> {
  type Model = { [K in keyof Fields]: Fields[K] extends MdslNode<infer S> ? z.infer<S> : never };

  const shape = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.schema]),
  ) as ZodRawShape;
  const schema = z.object(shape) as unknown as ZodType<Model>;

  const doc: MdslDocument<Model> = {
    [MDSL]: { kind: "document", fields },
    schema,
    validators: _validators,

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

    refine(fn: ValidatorFn<Model>) {
      return document(fields, [..._validators, fn]);
    },

    or(_other: MdslNode): MdslNode<ZodType<Model>> {
      throw new Error("document() nodes cannot be composed with .or()");
    },
  };

  return doc;
}

// ── Type helpers ──────────────────────────────────────────────────────────────

export type { InferMdsl as infer };
export { formatDiagnostics };
