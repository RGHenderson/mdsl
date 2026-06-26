# Diagnostics

Parse and validate return `ParseResult<T>`:

```typescript
type ParseResult<T> = {
  data: T | null;
  diagnostics: Diagnostic[];
  raw: Root; // MDAST
};
```

When `data` is `null`, inspect `diagnostics`. Use `formatDiagnostics` for human-readable output.

## Diagnostic fields

| Field        | Description                                           |
| ------------ | ----------------------------------------------------- |
| `severity`   | `'error'` or `'warning'`                              |
| `code`       | Stable code (see below)                               |
| `message`    | Human-readable description                            |
| `mdLocation` | `{ line, column, offset }` in markdown                |
| `jsonPath`   | Dot path, e.g. `timeline.items[0].actor`              |
| `source`     | `'markdown'` or `'json'` (when set)                   |
| `mapping`    | Builder hint, e.g. `frontmatter(...)` or `heading(1)` |
| `hint`       | Actionable guidance                                   |
| `expected`   | Expected shape (when applicable)                      |
| `received`   | Actual shape (when applicable)                        |

## Error codes

```typescript
import { DiagnosticCodes } from "@rghenderson/mdsl";
```

| Code                      | Meaning                        |
| ------------------------- | ------------------------------ |
| `MISSING_HEADING`         | Required heading not found     |
| `MISSING_FRONTMATTER`     | YAML frontmatter block missing |
| `FRONTMATTER_PARSE_ERROR` | Invalid YAML in frontmatter    |
| `MISSING_SECTION`         | Section heading not found      |
| `AMBIGUOUS_SECTION`       | Duplicate section heading      |
| `MISSING_PROSE`           | Expected paragraph content     |
| `MISSING_LIST`            | Expected bullet list           |
| `MISSING_TABLE`           | Expected GFM table             |
| `MISSING_CODE_BLOCK`      | Expected fenced code block     |
| `MISSING_REPEAT_ITEMS`    | No repeated sections found     |
| `COMPOSE_FAILED`          | No composed mapping matched    |
| `ZOD_VALIDATION`          | Schema validation failed       |

## Formatting

```typescript
import { formatDiagnostics } from "@rghenderson/mdsl";

console.error(formatDiagnostics(result.diagnostics));
// [ERROR] Line 14, col 0: Missing required section: "Ingredients" (json: ingredients, code: MISSING_SECTION)
```

## Strict mode

```typescript
SpecDoc.parse(markdown, { strict: true }); // throws MdslError
```

`MdslError.diagnostics` contains the full diagnostic list.

## Remark plugin

`remarkMdsl` attaches the same `ParseResult` to `file.data.mdsl` and adds fatal vfile messages for errors:

```typescript
import { remarkMdsl } from "@rghenderson/mdsl";

.use(remarkMdsl, { document: SpecDoc, strict: true })
```
