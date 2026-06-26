import { describe, expect, it } from "vitest";
import { z } from "zod";
import { document, frontmatter, heading, prose, section } from "../src/index.js";
import { runCli } from "../src/cli-runner.js";

const Doc = document({
  meta: frontmatter(z.object({ status: z.string() })),
  title: heading(1),
  summary: section("Summary", { body: prose() }),
});

describe("runCli", () => {
  it("parses markdown via injected document", async () => {
    const result = await runCli(["parse", "ignored.js", "-"], {
      document: Doc,
      stdin: "---\nstatus: ok\n---\n\n# Hello\n\n## Summary\n\nWorld\n",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"title": "Hello"');
  });

  it("returns exit code 1 on parse errors", async () => {
    const result = await runCli(["parse", "ignored.js", "-"], {
      document: Doc,
      stdin: "# Incomplete\n",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('"data": null');
  });

  it("validates json input", async () => {
    const json = JSON.stringify({
      title: "T",
      meta: { status: "ok" },
      summary: { body: "S" },
    });
    const result = await runCli(["validate", "ignored.js", "-"], {
      document: Doc,
      stdin: json,
    });
    expect(result.exitCode).toBe(0);
  });

  it("serializes valid json to markdown", async () => {
    const json = JSON.stringify({
      title: "T",
      meta: { status: "ok" },
      summary: { body: "S" },
    });
    const result = await runCli(["serialize", "ignored.js", "-"], {
      document: Doc,
      stdin: json,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("# T");
    expect(result.stdout).toContain("## Summary");
  });
});
