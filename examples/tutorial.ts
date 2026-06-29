import { z } from "zod";
import {
  document,
  frontmatter,
  title,
  image,
  prose,
  section,
  orderedList,
  codeBlocks,
  repeat,
  optional,
  formatDiagnostics,
} from "../src/index.js";

// ── Schema definition ─────────────────────────────────────────────────────────
//
// Demonstrates: title(), image(), orderedList(), codeBlocks(), repeat() with
// minItems: 0, and optional().

export const TutorialDoc = document({
  meta: frontmatter(
    z.object({
      slug: z.string().describe("URL slug"),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("Difficulty level"),
      tags: z.array(z.string()).describe("Topic tags"),
    }),
  ),
  name: title(),
  intro: section("Introduction", {
    hero: image(),
    body: prose(),
  }),
  prerequisites: section("Prerequisites", {
    items: orderedList(z.string().describe("A prerequisite the reader must have")),
  }),
  steps: repeat(
    /^Step \d+/,
    {
      body: prose(),
      snippets: codeBlocks("ts"),
    },
    2,
    { nameField: "title" },
  ),
  troubleshooting: optional(
    section("Troubleshooting", {
      items: repeat("Problem", { body: prose() }, 3, { minItems: 0 }),
    }),
  ),
});

export type Tutorial = typeof TutorialDoc extends { parse: (md: string) => { data: infer T } }
  ? T
  : never;

// ── Sample document ───────────────────────────────────────────────────────────

const MARKDOWN = `---
slug: getting-started-with-zod
difficulty: beginner
tags:
  - typescript
  - validation
---

# Getting started with Zod

## Introduction

![Zod logo](https://zod.dev/logo.svg "Zod — TypeScript-first schema validation")

Zod is a TypeScript-first schema declaration and validation library.
Define your schema once and get static types and runtime validation for free.

## Prerequisites

1. Node.js 18 or later
2. A TypeScript project with \`strict: true\`
3. Basic familiarity with TypeScript generics

## Step 1: Install

Install Zod from npm.

\`\`\`ts
npm install zod
\`\`\`

\`\`\`ts
import { z } from "zod";
\`\`\`

## Step 2: Define a schema

Create a schema for your data shape.

\`\`\`ts
const UserSchema = z.object({
  name: z.string(),
  age:  z.number().min(0),
  role: z.enum(["admin", "user"]),
});
\`\`\`

## Step 3: Parse and validate

Use \`.parse()\` to validate and infer the type in one call.

\`\`\`ts
const user = UserSchema.parse({ name: "Alice", age: 30, role: "admin" });
// user is fully typed: { name: string; age: number; role: "admin" | "user" }
\`\`\`

\`\`\`ts
// Use safeParse() to avoid throwing
const result = UserSchema.safeParse(unknownData);
if (result.success) {
  console.log(result.data.name);
}
\`\`\`

## Troubleshooting

### Problem

**Zod throws instead of returning errors.**

Use \`.safeParse()\` — it never throws and always returns a \`{ success, data, error }\` object.

### Problem

**Types don't propagate through \`.transform()\`.**

Make sure you use the output of \`.parse()\` or infer with \`z.infer<typeof schema>\`.
`;

// ── Run the example ───────────────────────────────────────────────────────────

const result = TutorialDoc.parse(MARKDOWN);

console.log("=".repeat(60));
console.log("TUTORIAL PARSE RESULT");
console.log("=".repeat(60));

console.log("\nDiagnostics:", result.diagnostics.length === 0 ? "✓ None" : formatDiagnostics(result.diagnostics));

console.log("\nTitle:      ", result.data?.name);
console.log("Hero image: ", result.data?.intro.hero);
console.log("Difficulty: ", result.data?.meta.difficulty);
console.log("Tags:       ", result.data?.meta.tags);
console.log("Prerequisites:");
result.data?.prerequisites.items.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));

console.log(`\nSteps (${result.data?.steps.length}):`);
result.data?.steps.forEach((step) => {
  console.log(`  ${step.title} — ${step.snippets.length} code snippet(s)`);
});

console.log(`\nTroubleshooting problems: ${result.data?.troubleshooting?.items.length ?? 0}`);

console.log("\n" + "=".repeat(60));
console.log("ROUND-TRIP");
console.log("=".repeat(60));

const serialized = TutorialDoc.serialize(result.data!);
const reparsed = TutorialDoc.parse(serialized);
console.log(
  "\nRound-trip:",
  reparsed.diagnostics.length === 0 ? "✓ Clean" : formatDiagnostics(reparsed.diagnostics),
);
console.log("Steps preserved:", reparsed.data!.steps.length === result.data!.steps.length ? "✓" : "✗");
