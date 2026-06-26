import { z } from "zod";
import { document, frontmatter, heading, list, prose, section, table } from "../src/index.js";

export const SpecDoc = document({
  meta: frontmatter(
    z.object({
      status: z.enum(["draft", "active", "archived"]),
      owner: z.string(),
    }),
  ),
  title: heading(1),
  summary: section("Summary", { body: prose() }),
  requirements: section("Requirements", { items: list(z.string()) }),
  api: section("API", {
    rows: table(
      z.object({
        endpoint: z.string(),
        method: z.string(),
        description: z.string(),
      }),
    ),
  }),
});

export default SpecDoc;
