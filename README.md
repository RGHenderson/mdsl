# mdsl

**Markdown Structured Language** — define typed schemas for markdown documents, then parse, validate, serialize, and generate LLM guidance from them.

```ts
import { z } from "zod";
import { document, frontmatter, section, prose, list } from "@rghenderson/mdsl";

const RecipeDoc = document({
  meta: frontmatter(
    z.object({
      title: z.string(),
      servings: z.number(),
    }),
  ),
  intro: section("Introduction", { body: prose() }),
  ingredients: section("Ingredients", {
    items: list(z.string()),
  }),
});

const result = RecipeDoc.parse(markdownString);
// result.data.meta.title  ← fully typed
// result.diagnostics      ← errors with markdown line:col + JSON path
```

## Install

```sh
npm install @rghenderson/mdsl zod
```

## Overview

`mdsl` lets you describe the structure of a markdown document using a schema, then use that schema to:

- **Parse** markdown → validated, fully-typed JSON model
- **Serialize** a JSON model → canonical markdown
- **Validate** a raw JSON object against the schema (no markdown needed)
- **Generate** JSON Schema for LLM structured output
- **Generate** authoring guidance, example documents, and fill-in templates for LLMs

## Builders

### `document(fields)`

Root builder. Returns an `MdslDocument<T>` with parse/serialize/LLM methods.

```ts
const Doc = document({ field: <node> });
type DocModel = InferDocument<typeof Doc>;
```

### `frontmatter(zodSchema)`

Maps the YAML frontmatter block at the top of the document.

```ts
frontmatter(z.object({ title: z.string(), tags: z.array(z.string()).optional() }));
```

### `section(heading, fields, depth?)`

Maps a heading + its content. Default depth is `2` (`##`).

```ts
section("Overview", { body: prose(), example: codeBlock("ts") });
section("Details", { notes: prose() }, 3); // ### Details
```

### `prose()`

Captures free-form paragraph text within the current section.

### `codeBlock(lang?)`

Captures a fenced code block, optionally filtered by language.

````ts
codeBlock("typescript"); // matches ```typescript blocks
codeBlock(); // matches any code block
````

### `list(itemSchema)`

Captures an unordered list. Each item is validated against `itemSchema`.

```ts
list(z.string());
list(z.object({ name: z.string(), qty: z.number() }));
```

### `table(rowSchema)`

Captures a GFM table. Each row is validated against `rowSchema` using column headers as keys.

```ts
table(z.object({ nutrient: z.string(), amount: z.string() }));
```

### `repeat(heading, fields, depth?)`

Collects every occurrence of a heading as an array of objects. Useful for repeating sections like changelog entries or sprint reports.

```ts
repeat("Sprint", { goal: prose(), tasks: list(z.string()) });
// ## Sprint … ## Sprint … → [{ goal, tasks }, { goal, tasks }]
```

### `optional(node)`

Makes any node optional — returns `undefined` rather than emitting a diagnostic when not found.

```ts
optional(section("Notes", { body: prose() }));
```

### `defaultValue(node, fallback)`

Like `optional`, but returns `fallback` when the node is missing.

```ts
defaultValue(codeBlock("json"), "{}");
```

### `compose(...nodes)`

Tries each node in order and returns the first that succeeds.

```ts
compose(codeBlock("typescript"), codeBlock("ts"), codeBlock());
```

## Parsing

```ts
const result = Doc.parse(markdownString);
// result.data        — validated model (typed), or null on failure
// result.diagnostics — Diagnostic[]
// result.raw         — raw MDAST (escape hatch)

// Strict mode — throws MdslError if there are any errors
Doc.parse(markdownString, { strict: true });
```

### Diagnostics

Each `Diagnostic` has:

```ts
{
  severity: "error" | "warning",
  message: string,
  code: DiagnosticCode,        // e.g. DiagnosticCodes.MISSING_SECTION
  mdLocation: { line, column, offset },
  jsonPath: string,             // e.g. "ingredients.items[2]"
  source?: "markdown" | "json",
  mapping?: string,
  hint?: string,
}
```

```ts
import { formatDiagnostics } from "@rghenderson/mdsl";
console.log(formatDiagnostics(result.diagnostics));
// [ERROR] Line 14, col 0: Missing required section: "Ingredients" (json: ingredients, code: MISSING_SECTION)
```

## Serialization

```ts
const markdown = Doc.serialize(result.data);
```

Serialization is round-trip stable: `parse(serialize(parse(md).data))` produces the same model.

## Validation

Validate a plain JSON object without parsing markdown:

```ts
const result = Doc.validate(jsonObject);
```

## LLM utilities

```ts
Doc.toJsonSchema(); // JSON Schema for structured output
Doc.toLlmJsonSchema(); // JSON Schema with mapping hints in descriptions
Doc.toGuidance(); // Markdown guide describing the document structure
Doc.toExampleMarkdown(); // A generated example document
Doc.toMarkdownTemplate(); // A fill-in-the-blanks template
Doc.toLlmGuide(); // Bundle: all of the above + mappingHints + instructions
```

## CLI

```sh
npm install -g @rghenderson/mdsl   # or use npx

mdsl parse ./recipe.js ./doc.md
mdsl validate ./recipe.js ./doc.json
mdsl serialize ./recipe.js ./doc.json --out ./doc.md
```

Definition modules must export a compiled `.js` `MdslDocument`. See [`docs/cli.md`](docs/cli.md).

## Remark plugin

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { remarkMdsl } from "@rghenderson/mdsl";

const file = await unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMdsl, { document: RecipeDoc, strict: true })
  .process(markdown);

file.data.mdsl?.data; // ParseResult
file.data.mdsl?.diagnostics;
```

## Registry

Use a registry to detect which schema a document belongs to and parse it in one step.

```ts
import { createRegistry } from "@rghenderson/mdsl";

const registry = createRegistry();
registry.register(RecipeDoc, (ctx) => ctx.frontmatter?.["type"] === "recipe");
registry.register(BlogDoc, (ctx) => ctx.frontmatter?.["type"] === "blog");

const result = registry.detect(markdownString); // { schema, frontmatter } | null
const parsed = registry.parse(markdownString); // { schema, data, diagnostics, raw } | null
```

Detection order: frontmatter `type` field → frontmatter `$schema` field → your custom matcher → structural heuristics.

## Type inference

```ts
import type { InferDocument } from "@rghenderson/mdsl";

type Recipe = InferDocument<typeof RecipeDoc>;
// { meta: { title: string; servings: number }, intro: { body: string }, ingredients: { items: string[] } }
```

## Documentation

- [Getting started](docs/getting-started.md)
- [Defining a flavour](docs/defining-a-flavour.md)
- [Mappings reference](docs/mappings-reference.md)
- [Heading levels](docs/heading-levels.md)
- [Diagnostics](docs/diagnostics.md)
- [LLM guides](docs/llm-guide.md)
- [CLI](docs/cli.md)

## License

MIT
