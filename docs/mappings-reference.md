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

## `heading(depth?)`

Extracts the first heading at the given depth (default `1`). Serializes as `# Title`.

```typescript
title: heading(1),
```

## `section(heading, fields, depth?)`

Maps a heading and its nested content. Default depth is `2` (`##`). The `fields` object holds child nodes:

```typescript
summary: section("Summary", { body: prose() }),
overview: section("Overview", {
  body: prose(),
  snippet: codeBlock("bash"),
}, 2),
```

## `prose()`

Free-form paragraph text within the current scope. In a section, use as a named field:

```typescript
section("Summary", { body: prose() });
```

## `codeBlock(lang?)`

Fenced code block, optionally filtered by language:

```typescript
snippet: codeBlock("typescript"),
tip: codeBlock(), // any language
```

## `list(itemSchema)`

Unordered list; each item validated against `itemSchema`:

```typescript
items: list(z.string()),
tags: list(z.object({ name: z.string(), value: z.number() })),
```

## `listItems()`

Sugar for `list(z.string())`.

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

Use a `RegExp` (e.g. `/.+/`) when each item has a **different** heading text. Pass `{ nameField: "name" }` to capture the heading text on each item:

```typescript
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
```

## `optional(node)`

Field may be absent without error:

```typescript
rollback: optional(section("Rollback", { body: prose() })),
```

## `defaultValue(node, fallback)`

Uses fallback when the inner node cannot be extracted:

```typescript
notes: defaultValue(section("Notes", { body: prose() }), { body: "No notes." }),
```

## `compose(...nodes)`

Tries nodes in order; first match wins:

```typescript
snippet: compose(codeBlock("typescript"), codeBlock()),
```
