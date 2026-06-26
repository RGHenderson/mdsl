import type { ZodType } from "zod";
import type { Point, Position } from "unist";
import type { Root } from "mdast";

export const MDSL = Symbol("mdsl");

export type MdslKind =
  | { kind: "document"; fields: Record<string, MdslNode> }
  | { kind: "frontmatter"; schema: ZodType }
  | { kind: "heading"; depth: number }
  | { kind: "section"; heading: string | RegExp; depth: number; fields: Record<string, MdslNode> }
  | { kind: "prose" }
  | { kind: "codeBlock"; lang: string | undefined }
  | { kind: "list"; itemSchema: ZodType }
  | { kind: "table"; rowSchema: ZodType }
  | { kind: "optional"; inner: MdslNode }
  | { kind: "defaultValue"; inner: MdslNode; fallback: unknown }
  | { kind: "compose"; nodes: MdslNode[] }
  | {
      kind: "repeat";
      heading: string | RegExp;
      depth: number;
      fields: Record<string, MdslNode>;
      nameField?: string;
    };

export interface MdslNode<S extends ZodType = ZodType> {
  [MDSL]: MdslKind;
  schema: S;
}

export interface ParseOptions {
  strict?: boolean;
}

export interface ValidationContext {
  error(path: string, message: string): void;
  warning(path: string, message: string): void;
}

export type ValidatorFn<T> = (data: T, ctx: ValidationContext) => void;

export interface LlmGuide {
  jsonSchema: object;
  llmJsonSchema: object;
  exampleJson: unknown;
  exampleMarkdown: string;
  template: string;
  guidance: string;
  systemPrompt: string;
  mappingHints: Record<string, string>;
  instructions: string;
}

export interface MdslDocument<T> extends MdslNode<ZodType<T>> {
  [MDSL]: { kind: "document"; fields: Record<string, MdslNode> };
  // biome-ignore lint/suspicious/noExplicitAny: validators are registered with the concrete type but stored loosely to preserve MdslDocument assignability
  validators: ValidatorFn<any>[];
  parse(markdown: string, options?: ParseOptions): ParseResult<T>;
  validate(data: unknown): ParseResult<T>;
  serialize(data: T): string;
  toJsonSchema(): object;
  toLlmJsonSchema(): object;
  toMarkdownTemplate(): string;
  toGuidance(): string;
  toLlmGuide(): LlmGuide;
  toExampleMarkdown(): string;
  refine(fn: ValidatorFn<T>): MdslDocument<T>;
}

export interface ParseResult<T> {
  data: T | null;
  diagnostics: Diagnostic[];
  raw: Root;
}

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  code: DiagnosticCode;
  mdLocation: Point;
  jsonPath: string;
  source?: "markdown" | "json";
  mapping?: string;
  hint?: string;
  expected?: string;
  received?: string;
}

export const DiagnosticCodes = {
  MISSING_HEADING: "MISSING_HEADING",
  MISSING_FRONTMATTER: "MISSING_FRONTMATTER",
  MISSING_SECTION: "MISSING_SECTION",
  AMBIGUOUS_SECTION: "AMBIGUOUS_SECTION",
  MISSING_PROSE: "MISSING_PROSE",
  MISSING_LIST: "MISSING_LIST",
  MISSING_TABLE: "MISSING_TABLE",
  INVALID_TABLE: "INVALID_TABLE",
  MISSING_CODE_BLOCK: "MISSING_CODE_BLOCK",
  MISSING_REPEAT_ITEMS: "MISSING_REPEAT_ITEMS",
  COMPOSE_FAILED: "COMPOSE_FAILED",
  ZOD_VALIDATION: "ZOD_VALIDATION",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  FRONTMATTER_PARSE_ERROR: "FRONTMATTER_PARSE_ERROR",
} as const;

export type DiagnosticCode = (typeof DiagnosticCodes)[keyof typeof DiagnosticCodes];

export class MdslError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: Diagnostic[],
  ) {
    super(message);
    this.name = "MdslError";
  }
}

export type InferMdsl<D extends MdslDocument<unknown>> =
  D extends MdslDocument<infer T> ? T : never;

export type InferDocument<D extends MdslDocument<unknown>> = InferMdsl<D>;

export type MdslPoint = Point;
export type MdslPosition = Position;
