import type { Root } from "mdast";
import type { Plugin } from "unified";
import type { VFile } from "vfile";
import type { MdslDocument } from "./schema/types.js";

export type RemarkMdslOptions = {
  document: MdslDocument<unknown>;
  strict?: boolean;
};

export const remarkMdsl: Plugin<[RemarkMdslOptions], Root> = function (options) {
  return function transformer(_tree: Root, file: VFile) {
    const source = String(file?.value ?? file?.toString?.() ?? "");
    const result = options.document.parse(
      source,
      options.strict === undefined ? {} : { strict: options.strict },
    );

    const data = file?.data ?? (file!.data = {});
    data.mdsl = result;

    if (result.diagnostics.length > 0) {
      for (const diagnostic of result.diagnostics) {
        const message = file?.message(
          `[mdsl] ${diagnostic.message}`,
          {
            line: diagnostic.mdLocation.line,
            column: diagnostic.mdLocation.column,
          },
          `mdsl:${diagnostic.code}`,
        );
        if (message && diagnostic.severity === "error") {
          message.fatal = true;
        }
      }
    }

    return _tree;
  };
};
