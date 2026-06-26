# Heading levels

Markdown is **flat**: `## Steps` and `## Summary` are siblings in the AST, not parent and child. MDSL slices sections by finding a heading and reading until the next heading **at the same or higher level**.

## Rules

1. **Document title** — `heading(1)` → `# Title`
2. **Top-level sections** — `section("Summary", { ... })` → `## Summary` (depth 2 by default)
3. **Repeated items** — `repeat(..., fields, 3, { nameField: "name" })` → each `### Item name`
4. **Nested fields inside items** — use a **deeper** depth than the repeat delimiter

```markdown
## Timeline

### Detection

#### Timestamp

2026-06-10T14:05:00Z

#### Actor

Monitoring pipeline
```

Matching document definition:

```typescript
timeline: section("Timeline", {
  items: repeat(
    /.+/,
    {
      timestamp: section("Timestamp", { body: prose() }, 4),
      actor: section("Actor", { body: prose() }, 4),
    },
    3,
    { nameField: "name" },
  ),
}),
```

## Common mistake

Using `## Command` inside a `###` step item closes the parent `## Steps` section early, because both are level-2 siblings in the flat AST.

**Wrong:**

```markdown
## Steps

### Step one

## Command
```

**Right:**

```markdown
## Steps

### Step one

#### Command
```

## Optional sections

```typescript
rollback: optional(section("Rollback", { body: prose() })),
```

Absence is not an error; the field is `undefined` in the parsed JSON.

## Serialization order

Define `frontmatter` before `title` and body sections so round-trips keep YAML at the top of the file.
