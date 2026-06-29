import { describe, expect, it } from "vitest";
import { z } from "zod";
import { document, frontmatter, title, prose, section } from "../src/index.js";
import { remarkMdsl } from "../src/remark-entrypoint.js";

const Doc = document({
  meta: frontmatter(z.object({ status: z.string() })),
  title: title(),
  summary: section("Summary", { body: prose() }),
});

import type { ParseResult } from "../src/schema/types.js";

declare module "vfile" {
  interface DataMap {
    mdsl?: ParseResult<unknown>;
  }
}

describe("remarkMdsl", () => {
  it("attaches parse result to file data", async () => {
    const { unified } = await import("unified");
    const remarkParse = (await import("remark-parse")).default;
    const remarkGfm = (await import("remark-gfm")).default;
    const remarkStringify = (await import("remark-stringify")).default;
    const markdown = "---\nstatus: ok\n---\n\n# Title\n\n## Summary\n\nHello\n";

    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkStringify)
      .use(remarkMdsl, { document: Doc })
      .process(markdown);

    const mdsl = file.data.mdsl;
    expect(mdsl?.data).not.toBeNull();
    const data = mdsl!.data as { title: string; summary: { body: string } };
    expect(data.title).toBe("Title");
    expect(data.summary.body).toContain("Hello");
    expect(mdsl!.diagnostics).toHaveLength(0);
  });

  it("adds fatal vfile messages on errors", async () => {
    const { unified } = await import("unified");
    const remarkParse = (await import("remark-parse")).default;
    const remarkStringify = (await import("remark-stringify")).default;
    const markdown = "# Title only\n";

    const file = await unified()
      .use(remarkParse)
      .use(remarkStringify)
      .use(remarkMdsl, { document: Doc })
      .process(markdown);

    expect(file.data.mdsl?.data).toBeNull();
    expect(file.messages.some((m) => m.fatal)).toBe(true);
  });
});
