export {
  document,
  frontmatter,
  section,
  prose,
  codeBlock,
  list,
  table,
  optional,
  defaultValue,
  compose,
  repeat,
  formatDiagnostics,
} from "./schema/builders.js";

export type { infer } from "./schema/builders.js";

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
  InferMdsl,
} from "./schema/types.js";

export type { Registry, MatchContext, MatchFn } from "./schema/registry.js";

export { generateExampleData } from "./llm/guidance.js";
export { collectMappingHints } from "./llm/json-schema.js";
