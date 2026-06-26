# LLM guides

MDSL can export artefacts that help LLMs write markdown your code can parse: JSON Schema for structured output, skeleton templates, worked examples, and a ready-made instruction block.

## Quick usage

```typescript
import { z } from "zod";
import { document, frontmatter, section, prose } from "@rghenderson/mdsl";

const Doc = document({
  meta: frontmatter(z.object({ title: z.string().describe("Document title") })),
  summary: section("Summary", { body: prose() }),
});

const schema = Doc.toLlmJsonSchema();
const template = Doc.toMarkdownTemplate();
const example = Doc.toExampleMarkdown();
const guide = Doc.toLlmGuide();

console.log(guide.systemPrompt);
console.log(guide.mappingHints);
```

Pass `guide.llmJsonSchema` to an LLM structured-output API. Pass `guide.instructions` (alias of `systemPrompt`) or combine `guide.template` + `guide.exampleMarkdown` as context when the model writes markdown directly.

## `toLlmGuide()` bundle

| Field             | Description                                    |
| ----------------- | ---------------------------------------------- |
| `jsonSchema`      | Standard JSON Schema from the document         |
| `llmJsonSchema`   | JSON Schema with mapping hints in descriptions |
| `exampleJson`     | Plausible JSON from `generateExampleData()`    |
| `exampleMarkdown` | Serialized example document                    |
| `template`        | Skeleton markdown with placeholders            |
| `guidance`        | Markdown structure guide                       |
| `systemPrompt`    | Full assembled prompt for LLM authors          |
| `mappingHints`    | Field path → markdown location map             |
| `instructions`    | Alias of `systemPrompt`                        |

## API

| Method / export         | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `toJsonSchema()`        | JSON Schema for the document model                 |
| `toLlmJsonSchema()`     | Same with mapping hints injected into descriptions |
| `toMarkdownTemplate()`  | Skeleton with `<placeholders>`                     |
| `toExampleMarkdown()`   | Example from schema + serialize                    |
| `toGuidance()`          | Structure guide only                               |
| `toLlmGuide()`          | Full bundle (see table above)                      |
| `generateExampleData()` | Standalone plausible JSON from a Zod schema        |
| `collectMappingHints()` | Field → markdown location reference                |

## Prompt patterns

### Structured JSON first

1. Provide `toLlmJsonSchema()` as the response schema.
2. Validate with `Doc.validate(json)`.
3. Serialize with `Doc.serialize(data)` to produce markdown.

### Markdown first

1. Provide `toLlmGuide().instructions` (includes template + example + field map).
2. Parse with `Doc.parse(markdown)`.
3. Use `diagnostics` to iterate if parsing fails.

### Hybrid

Use the schema for a planning pass (outline as JSON), then a second pass with `toMarkdownTemplate()` to render prose and tables.

## Zod descriptions

Zod `.describe()` on fields is preserved in JSON Schema and used as example values by `generateExampleData()`:

```typescript
z.object({
  title: z.string().describe("London"),
});
// generateExampleData → { title: "London" }
```

Mapping hints from `collectMappingHints()` are merged into `llmJsonSchema` property descriptions.
