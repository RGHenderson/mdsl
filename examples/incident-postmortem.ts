import { z } from "zod";
import {
  document,
  frontmatter,
  heading,
  list,
  optional,
  prose,
  repeat,
  section,
  table,
} from "../src/index.js";

export const IncidentPostmortem = document({
  meta: frontmatter(
    z.object({
      status: z.enum(["draft", "published"]),
      severity: z.enum(["sev1", "sev2", "sev3"]),
      owner: z.string(),
      reviewers: z.array(z.string()),
    }),
  ),
  title: heading(1),
  summary: section("Summary", { body: prose() }),
  rollback: optional(section("Rollback", { body: prose() })),
  timeline: section("Timeline", {
    items: repeat(
      /.+/,
      {
        timestamp: section("Timestamp", { body: prose() }, 4),
        actor: section("Actor", { body: prose() }, 4),
        details: section("Details", { body: prose() }, 4),
      },
      3,
      { nameField: "name" },
    ),
  }),
  impactedServices: section("Impacted Services", {
    items: list(z.string()),
  }),
  rootCauses: section("Root Causes", {
    items: repeat(
      /.+/,
      {
        analysis: section("Analysis", { body: prose() }, 4),
        contributingFactors: section("Contributing Factors", { items: list(z.string()) }, 4),
      },
      3,
      { nameField: "name" },
    ),
  }),
  actionItems: section("Action Items", {
    items: repeat(
      /.+/,
      {
        owner: section("Owner", { body: prose() }, 4),
        dueDate: section("Due Date", { body: prose() }, 4),
        status: section("Status", { body: prose() }, 4),
      },
      3,
      { nameField: "name" },
    ),
  }),
  apiChanges: section("API Changes", {
    rows: table(
      z.object({
        endpoint: z.string(),
        method: z.string(),
        change: z.string(),
        breaking: z.string(),
      }),
    ),
  }),
  decisions: section("Decisions", {
    items: repeat(
      /.+/,
      {
        context: section("Context", { body: prose() }, 4),
        decision: section("Decision", { body: prose() }, 4),
        consequences: section("Consequences", { items: list(z.string()) }, 4),
      },
      3,
      { nameField: "name" },
    ),
  }),
});

export default IncidentPostmortem;
