export {
  document,
  frontmatter,
  heading,
  section,
  prose,
  codeBlock,
  codeBlocks,
  blockquote,
  image,
  list,
  orderedList,
  listItems,
  table,
  optional,
  defaultValue,
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
  InferMdsl,
  ValidationContext,
  ValidatorFn,
} from "./schema/types.js";

export type { Registry, MatchContext, MatchFn } from "./schema/registry.js";

export { generateExampleData } from "./llm/guidance.js";
export { collectMappingHints } from "./llm/json-schema.js";

export { remarkMdsl } from "./remark-plugin.js";
export type { RemarkMdslOptions } from "./remark-plugin.js";

export { runCli, loadDocument, printHelp } from "./cli-runner.js";
export type { CliIo, CliResult } from "./cli-runner.js";
