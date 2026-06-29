# Defining a flavour

A **flavour** is an `MdslDocument` created with `document()`. It defines:

1. **Structure** — nested fields, each with a builder node and embedded Zod schema
2. **Parse** — markdown → validated JSON (`ParseResult`)
3. **Serialize** — JSON → canonical markdown
4. **Validate** — JSON-only validation without markdown
5. **LLM exports** — JSON Schema, templates, and prompt bundles

## `MdslDocument` API

| Method                  | Description                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `.parse(md, options?)`  | Returns `ParseResult<T>` with `data`, `diagnostics`, and `raw` MDAST                         |
| `.serialize(data)`      | Returns canonical markdown string                                                            |
| `.validate(json)`       | Validates JSON without parsing markdown                                                      |
| `.toJsonSchema()`       | Exports JSON Schema                                                                          |
| `.toLlmJsonSchema()`    | JSON Schema with mapping hints in descriptions                                               |
| `.toMarkdownTemplate()` | Fill-in-the-blanks markdown skeleton                                                         |
| `.toExampleMarkdown()`  | Generated example document                                                                   |
| `.toGuidance()`         | Markdown structure guide                                                                     |
| `.toLlmGuide()`         | Full LLM bundle (schema, template, examples, `systemPrompt`, `mappingHints`, `instructions`) |

## Parse options

- `strict: true` — throw `MdslError` on any error-severity diagnostic

## Field ordering

Serialization walks fields in object definition order. Put **`frontmatter` first** so YAML stays at the top of the output file, then `title` / other top-level fields.

## Registry (multi-flavour)

Use `createRegistry()` to register several flavours and detect which one matches a markdown file:

```typescript
import { createRegistry } from "@rghenderson/mdsl";

const registry = createRegistry();
registry.register(SpecDoc, (ctx) => ctx.frontmatter?.type === "spec");
registry.register(Runbook, (ctx) => ctx.frontmatter?.type === "runbook");

const result = registry.parse(markdown); // or registry.detect(markdown)
```

## Examples in this repo

- [`examples/recipe.ts`](../examples/recipe.ts) — frontmatter, sections, list, code block, table
- [`examples/spec-doc.ts`](../examples/spec-doc.ts) — frontmatter, title, sections, table
- [`examples/runbook.ts`](../examples/runbook.ts) — repeated steps with named headings
- [`examples/incident-postmortem.ts`](../examples/incident-postmortem.ts) — complex nested structure
- [`examples/tutorial.ts`](../examples/tutorial.ts) — title, image, orderedList, codeBlocks, minItems
