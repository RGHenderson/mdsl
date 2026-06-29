export {
  document,
  frontmatter,
  title,
  section,
  prose,
  codeBlock,
  codeBlocks,
  blockquote,
  image,
  list,
  orderedList,
  table,
  optional,
  withDefault,
  compose,
  repeat,
  rule,
  formatDiagnostics,
} from "./schema/builders.js";

export type { infer, RepeatOptions, ImageValue } from "./schema/builders.js";

export { createRegistry } from "./schema/registry.js";

export { DiagnosticCodes, MdslError } from "./schema/types.js";

export type {
  MdslDocument,
  MdslNode,
  ParseResult,
  ParseOptions,
  Diagnostic,
  DiagnosticCode,
  LlmGuide,
  MdslPoint,
  MdslPosition,
  InferDocument,
  ValidationContext,
  ValidatorFn,
} from "./schema/types.js";

export type { Registry, MatchContext, MatchFn } from "./schema/registry.js";
