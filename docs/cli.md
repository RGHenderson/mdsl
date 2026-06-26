# CLI

```bash
npx mdsl <command> <definition.js> [input] [options]
```

## Commands

| Command     | Description                             |
| ----------- | --------------------------------------- |
| `parse`     | Markdown → `ParseResult` JSON on stdout |
| `validate`  | JSON → `ParseResult` on stdout          |
| `serialize` | JSON → canonical markdown on stdout     |

## Definition module

The definition must be a **compiled JavaScript** module exporting a default `MdslDocument`:

```bash
# Compile your definition (example)
npx tsc examples/spec-doc.ts --module esnext --target es2022 --moduleResolution bundler

mdsl parse ./examples/spec-doc.js ./tests/fixtures/spec-doc.md
```

TypeScript source files (`.ts`) are rejected with a clear error.

### Example in this repo

Compile [`examples/spec-doc.ts`](../examples/spec-doc.ts) (imports `@rghenderson/mdsl` and `zod`), then:

```bash
npm run build
mdsl parse ./examples/spec-doc.js ./tests/fixtures/spec-doc.md
```

## Stdin

Use `-` as the input path:

```bash
cat document.md | mdsl parse ./spec-doc.js -
cat document.json | mdsl serialize ./spec-doc.js -
```

## Formatted errors

On failure, formatted diagnostics are printed to stderr in addition to the JSON `ParseResult`.

```bash
mdsl parse ./spec-doc.js ./bad.md
# stderr: 1:1 [MISSING_HEADING] Missing # heading ...
```
