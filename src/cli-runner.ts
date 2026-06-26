import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { formatDiagnostics } from "./llm/json-schema.js";
import type { MdslDocument } from "./schema/types.js";

type Command = "parse" | "validate" | "serialize";

export type CliIo = {
  stdin?: string;
  document?: MdslDocument<unknown>;
  writtenFiles?: Map<string, string>;
};

export type CliResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export function printHelp(command?: string): void {
  if (!command) {
    console.log(`mdsl — MDSL (Markdown Structured Language) CLI

Usage:
  mdsl <command> <definition.js> [input] [options]

Commands:
  parse      Parse markdown to JSON (ParseResult)
  validate   Validate JSON against the document schema
  serialize  Serialize JSON to canonical markdown

Options:
  --out <file>   Write serialized markdown to a file (serialize only)
  -h, --help     Show help

Notes:
  <definition.js> must be a compiled JavaScript module exporting a default
  MdslDocument. Compile TypeScript definitions first, e.g.:
    npx tsc examples/recipe.ts --module esnext --target es2022

Examples:
  mdsl parse ./recipe.js ./document.md
  mdsl validate ./recipe.js ./document.json
  mdsl serialize ./recipe.js ./document.json --out ./document.md
  cat doc.md | mdsl parse ./recipe.js -`);
    return;
  }

  console.log(`mdsl ${command} — see "mdsl --help" for usage`);
}

export async function loadDocument(path: string): Promise<MdslDocument<unknown>> {
  if (path.endsWith(".ts")) {
    throw new Error(
      `Definition must be a compiled JavaScript module (.js), not TypeScript: ${path}\n` +
        "Compile your definition first or use a .js output file. See: mdsl --help",
    );
  }

  const module = await import(pathToFileURL(path).href);
  const document = module.default ?? module.document ?? module.definition;
  if (!document || typeof document.parse !== "function") {
    throw new Error(`Definition module must export a default MdslDocument: ${path}`);
  }
  return document as MdslDocument<unknown>;
}

function readInput(path: string | undefined, stdin: string): string {
  if (!path || path === "-") {
    return stdin;
  }
  return readFileSync(path, "utf8");
}

function writeOutput(path: string, content: string, io: CliIo): void {
  if (io.writtenFiles) {
    io.writtenFiles.set(path, content);
    return;
  }
  writeFileSync(path, content, "utf8");
}

/** Run the CLI in-process. Used by tests and the `mdsl` bin entry. */
export async function runCli(argv: string[], io: CliIo = {}): Promise<CliResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode = 0;

  const log = console.log;
  const error = console.error;
  const stdoutWrite = process.stdout.write.bind(process.stdout);

  console.log = (...args: unknown[]) => {
    stdout.push(`${args.map(String).join(" ")}\n`);
  };
  console.error = (...args: unknown[]) => {
    stderr.push(`${args.map(String).join(" ")}\n`);
  };
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stdout.write;

  const finish = (): CliResult => {
    console.log = log;
    console.error = error;
    process.stdout.write = stdoutWrite;
    return { stdout: stdout.join(""), stderr: stderr.join(""), exitCode };
  };

  try {
    if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
      printHelp();
      return finish();
    }

    const command = argv[0];
    if (command === "-h" || command === "--help") {
      printHelp();
      return finish();
    }

    const definitionPath = argv[1];
    if (!definitionPath) {
      printHelp();
      exitCode = 1;
      return finish();
    }

    if (definitionPath === "-h" || definitionPath === "--help") {
      printHelp(command);
      return finish();
    }

    const inputPath = argv[2];
    const rest = argv.slice(3);
    const document = io.document ?? (await loadDocument(definitionPath));
    const stdin = io.stdin ?? "";

    switch (command as Command) {
      case "parse": {
        const markdown = readInput(inputPath, stdin);
        const result = document.parse(markdown);
        console.log(JSON.stringify(result, null, 2));
        if (result.diagnostics.length > 0) {
          console.error("\n" + formatDiagnostics(result.diagnostics));
        }
        if (result.diagnostics.some((d) => d.severity === "error")) {
          exitCode = 1;
        }
        break;
      }
      case "validate": {
        let json: unknown;
        try {
          json = JSON.parse(readInput(inputPath, stdin));
        } catch {
          console.error("Invalid JSON input");
          exitCode = 1;
          break;
        }
        const result = document.validate(json);
        console.log(JSON.stringify(result, null, 2));
        if (result.diagnostics.length > 0) {
          console.error("\n" + formatDiagnostics(result.diagnostics));
        }
        if (!result.data) exitCode = 1;
        break;
      }
      case "serialize": {
        const outIndex = rest.indexOf("--out");
        const outPath = outIndex >= 0 ? rest[outIndex + 1] : undefined;
        let json: unknown;
        try {
          json = JSON.parse(readInput(inputPath, stdin));
        } catch {
          console.error("Invalid JSON input");
          exitCode = 1;
          break;
        }
        const validation = document.validate(json);
        if (!validation.data) {
          console.error(formatDiagnostics(validation.diagnostics));
          exitCode = 1;
          break;
        }
        const markdown = document.serialize(validation.data);
        if (outPath) {
          writeOutput(outPath, markdown, io);
        } else {
          process.stdout.write(markdown);
        }
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        exitCode = 1;
    }
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    exitCode = 1;
  }

  return finish();
}
