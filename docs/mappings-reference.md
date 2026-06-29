# Mappings reference

All builders return an `MdslNode` with an embedded Zod schema. Compose them inside `document({ ... })`.

## `document(fields)`

Root builder. Returns `MdslDocument<T>`.

## `frontmatter(zodSchema)`

Maps the YAML block at the top of the file to a nested object:

```typescript
meta: frontmatter(
  z.object({
    status: z.enum(["draft", "active"]),
    owner: z.string(),
  }),
),
```

## `title()`

Captures the document's primary `#` heading text.

```typescript
name: title(),  // # My Document → "My Document"
```

## `section(heading, fields, depth?, options?)`

Maps a heading and its nested content. Default depth is `2` (`##`). The `fields` object holds child nodes:

```typescript
summary: section("Summary", { body: prose() }),
overview: section("Overview", {
  body: prose(),
  snippet: codeBlock("bash"),
}, 2),
```

When the heading is a `RegExp`, you **must** provide `nameField` to capture the heading text — otherwise serialization will throw:

```typescript
step: section(/^Step \d+/, { body: prose() }, 2, { nameField: "title" }),
// "## Step 1\n\nContent." → { title: "Step 1", body: "Content." }
```

## `prose()`

Free-form paragraph text within the current scope. In a section, use as a named field:

```typescript
section("Summary", { body: prose() });
```

## `codeBlock(lang?)`

The **first** fenced code block, optionally filtered by language:

```typescript
snippet: codeBlock("typescript"),
tip:     codeBlock(), // any language
```

## `codeBlocks(lang?)`

**All** fenced code blocks in the section as a `string[]`, optionally filtered by language. Use this when a section contains multiple examples or steps expressed as code.

```typescript
examples: codeBlocks("ts"),
// ```ts\nconst a = 1;\n``` and ```ts\nconst b = 2;\n```
// → ["const a = 1;", "const b = 2;"]

all: codeBlocks(), // every code block regardless of language
```

## `image()`

Captures a markdown image (`![alt](url "title")`) as `{ alt: string, url: string, title?: string }`. The exported `ImageValue` type matches this shape.

```typescript
diagram: image(),
// ![Architecture](arch.png "Figure 1")
// → { alt: "Architecture", url: "arch.png", title: "Figure 1" }
```

## `blockquote()`

Captures the first `> …` blockquote in the section as a markdown string.

```typescript
callout: blockquote(),
// > Important: restart the service.
```

## `list(itemSchema, options?)`

A list; each item validated against `itemSchema`. By default matches both ordered and unordered lists. Pass `{ ordered: true }` to match only numbered lists, or `{ ordered: false }` to match only bullet lists.

```typescript
items:  list(z.string()),                        // - item or 1. item
steps:  list(z.string(), { ordered: true }),     // 1. step only
bullets: list(z.string(), { ordered: false }),   // - bullet only
tags:   list(z.object({ name: z.string(), value: z.number() })),
```

## `orderedList(itemSchema)`

Shorthand for `list(itemSchema, { ordered: true })`. Items serialize as `1.` `2.` `3.` markers.

```typescript
steps: orderedList(z.string()),
// 1. First\n2. Second → ["First", "Second"]
```

## `table(rowSchema)`

GFM table rows validated against a Zod object. **Column headers in markdown must match the object's keys**:

```typescript
rows: table(
  z.object({
    endpoint: z.string(),
    method: z.string(),
    description: z.string(),
  }),
),
```

```markdown
| endpoint | method | description   |
| -------- | ------ | ------------- |
| /retry   | POST   | Trigger retry |
```

## `repeat(heading, fields, depth?, options?)`

Collects repeated sections as an array. Use a fixed heading string when every item shares the same title:

```typescript
sprints: repeat("Sprint", {
  goal: prose(),
  tasks: list(z.string()),
}, 2),
```

Use a `RegExp` when each item has a **different** heading text. Pass `{ nameField: "name" }` to capture the heading text on each item (required for serialization when using a regex heading):

```typescript
steps: repeat(
  /^Step \d+/,
  { body: prose() },
  2,
  { nameField: "title" },
),
// ## Step 1 … ## Step 2 → [{ title: "Step 1", body: "…" }, { title: "Step 2", body: "…" }]
```

### `minItems`

By default `repeat()` requires at least one occurrence. Set `minItems: 0` for zero-or-more semantics (returns `[]` instead of an error when no matching headings are found):

```typescript
notes: repeat("Note", { body: prose() }, 2, { minItems: 0 }),
```

## `optional(node)`

Field may be absent without error:

```typescript
rollback: optional(section("Rollback", { body: prose() })),
```

## `withDefault(node, fallback)`

Uses fallback when the inner node cannot be extracted:

```typescript
notes: withDefault(section("Notes", { body: prose() }), { body: "No notes." }),
```

## `compose(...nodes)`

Tries nodes in order; first match wins:

```typescript
snippet: compose(codeBlock("typescript"), codeBlock()),
```

> **Serialization note:** `compose()` always serializes using the **first** node in the list regardless of which branch matched during parsing. This is fine when all branches produce the same markdown structure (e.g. different language aliases for the same code block). If the branches differ structurally (e.g. `compose(prose(), codeBlock())`), the serialized output may not match the original source, though a subsequent parse will still succeed.

## `rule(name, node)`

Attaches a display name to any node for clearer diagnostics and LLM guidance output:

```typescript
hero: rule("hero image", image()),
```
