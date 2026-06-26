import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IncidentPostmortem } from "../examples/incident-postmortem.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "fixtures");

function loadMarkdown(name: string) {
  return readFileSync(join(fixtures, `${name}.md`), "utf8");
}

describe("incident postmortem (complex document)", () => {
  const markdown = loadMarkdown("incident-postmortem");

  it("parses the full complex structure", () => {
    const result = IncidentPostmortem.parse(markdown);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(result.data).not.toBeNull();
    expect(result.data!.title).toBe("Search Index Lag 2026-03-15");
    expect(result.data!.timeline.items).toHaveLength(2);
    expect(result.data!.timeline.items[0]!.name).toBe("Detection");
  });

  it("allows optional rollback to be omitted", () => {
    const withoutRollback = markdown.replace(/\n## Rollback\n\n[\s\S]*?(?=\n## Timeline)/, "\n");
    const result = IncidentPostmortem.parse(withoutRollback);

    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(result.data?.rollback).toBeUndefined();
    expect(result.data?.timeline.items).toHaveLength(2);
  });
});
