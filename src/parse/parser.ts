import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { Root } from "mdast";
import {
  MDSL,
  DiagnosticCodes,
  MdslError,
  type MdslDocument,
  type ParseResult,
  type Diagnostic,
  type ParseOptions,
  type ValidationContext,
} from "../schema/types.js";
import { extractFields } from "./mappers.js";

function buildProcessor() {
  return remark().use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
}

function zodPathToJsonPath(path: (string | number)[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === "number") return `${acc}[${seg}]`;
    return acc ? `${acc}.${seg}` : seg;
  }, "");
}

export function parseAst<T>(
  ast: Root,
  doc: MdslDocument<T>,
  options: ParseOptions = {},
): ParseResult<T> {
  const diags: Diagnostic[] = [];
  const meta = doc[MDSL];
  const raw = extractFields(ast, meta.fields, "", diags);

  const zodResult = doc.schema.safeParse(raw);

  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      const path = zodPathToJsonPath(issue.path as (string | number)[]);
      const alreadyReported = diags.some((d) => d.jsonPath === path);
      if (!alreadyReported) {
        diags.push({
          severity: "error",
          message: issue.message,
          code: DiagnosticCodes.ZOD_VALIDATION,
          mdLocation: { line: 1, column: 0, offset: 0 },
          jsonPath: path,
        });
      }
    }
  }

  const structuralErrors = diags.filter((d) => d.severity === "error");
  const structurallyValid = structuralErrors.length === 0 && zodResult.success;

  if (structurallyValid && doc.validators.length > 0) {
    runValidators(zodResult.data, doc.validators, diags);
  }

  const errors = diags.filter((d) => d.severity === "error");
  if (options.strict && errors.length > 0) {
    throw new MdslError(`MDSL parse failed with ${errors.length} error(s)`, diags);
  }

  return {
    data: structurallyValid ? zodResult.data : null,
    diagnostics: diags,
    raw: ast,
  };
}

function runValidators<T>(
  data: T,
  validators: MdslDocument<T>["validators"],
  diags: Diagnostic[],
): void {
  const ctx: ValidationContext = {
    error(path, message) {
      diags.push({
        severity: "error",
        message,
        code: DiagnosticCodes.VALIDATION_ERROR,
        mdLocation: { line: 1, column: 0, offset: 0 },
        jsonPath: path,
        source: "json",
      });
    },
    warning(path, message) {
      diags.push({
        severity: "warning",
        message,
        code: DiagnosticCodes.VALIDATION_ERROR,
        mdLocation: { line: 1, column: 0, offset: 0 },
        jsonPath: path,
        source: "json",
      });
    },
  };
  for (const fn of validators) {
    fn(data, ctx);
  }
}

export function parseMarkdown<T>(
  markdown: string,
  doc: MdslDocument<T>,
  options: ParseOptions = {},
): ParseResult<T> {
  const processor = buildProcessor();
  const ast = processor.parse(markdown) as Root;
  return parseAst(ast, doc, options);
}

export function validateData<T>(data: unknown, doc: MdslDocument<T>): ParseResult<T> {
  const diags: Diagnostic[] = [];
  const zodResult = doc.schema.safeParse(data);

  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      diags.push({
        severity: "error",
        message: issue.message,
        code: DiagnosticCodes.ZOD_VALIDATION,
        mdLocation: { line: 1, column: 0, offset: 0 },
        jsonPath: zodPathToJsonPath(issue.path as (string | number)[]),
      });
    }
  }

  const structurallyValid =
    diags.filter((d) => d.severity === "error").length === 0 && zodResult.success;

  if (structurallyValid && doc.validators.length > 0) {
    runValidators(zodResult.data, doc.validators, diags);
  }

  // Use an empty root as a stub — validate() has no markdown source
  const stubAst: Root = { type: "root", children: [] };

  return {
    data: structurallyValid ? zodResult.data : null,
    diagnostics: diags,
    raw: stubAst,
  };
}
