import { z } from "zod";
import { document, frontmatter, heading, prose, repeat, section } from "../src/index.js";

export const Runbook = document({
  meta: frontmatter(
    z.object({
      status: z.enum(["draft", "active"]),
    }),
  ),
  title: heading(1),
  steps: section("Steps", {
    items: repeat(
      /.+/,
      {
        command: section("Command", { body: prose() }, 4),
      },
      3,
      { nameField: "name" },
    ),
  }),
});

export default Runbook;
