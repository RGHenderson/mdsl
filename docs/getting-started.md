# Getting started

MDSL (**MarkDown Structured Language**) is a schema-driven library for bidirectional markdown ↔ JSON conversion.

## Install

```bash
npm install @rghenderson/mdsl zod
```

MDSL requires **Zod 4** as a peer dependency.

## Define a flavour

A **flavour** is an `MdslDocument` created with `document()`. Each field is a builder node that carries its own Zod schema — the root JSON shape is nested and inferred from those nodes.

```typescript
import { z } from "zod";
import { document, frontmatter, heading, list, prose, section, table } from "@rghenderson/mdsl";

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
```

A document conforming to this schema looks like:

```markdown
---
status: draft
owner: alice
---

# Search Ranking Improvements

## Summary

Improves result relevance using signals from user engagement data.

## Requirements

- Incorporate click-through rate as a ranking signal
- Re-rank results within 500ms p99
- Degrade gracefully when signal data is unavailable

## API

| endpoint  | method | description        |
| --------- | ------ | ------------------ |
| /v1/rank  | POST   | Score a result set |
```

Parsed JSON looks like:

```json
{
  "meta": { "status": "draft", "owner": "alice" },
  "title": "Search Ranking Improvements",
  "summary": { "body": "..." },
  "requirements": { "items": ["..."] },
  "api": { "rows": [{ "endpoint": "...", "method": "...", "description": "..." }] }
}
```

Place **`frontmatter` first** in the field list so serialization keeps YAML at the top of the file.

## Parse and serialize

```typescript
const result = SpecDoc.parse(markdown);

if (!result.data) {
  console.error(result.diagnostics);
} else {
  const canonical = SpecDoc.serialize(result.data);
}
```

## Type inference

```typescript
import type { InferDocument } from "@rghenderson/mdsl";

type Spec = InferDocument<typeof SpecDoc>;
```

## Next steps

- [Defining a flavour](./defining-a-flavour.md)
- [Mappings reference](./mappings-reference.md)
- [Diagnostics](./diagnostics.md)
- [Heading levels](./heading-levels.md)
- [CLI](./cli.md)
