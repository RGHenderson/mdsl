import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IncidentPostmortem } from "../examples/incident-postmortem.js";
import { Runbook } from "../examples/runbook.js";
import { SpecDoc } from "../examples/spec-doc.js";
import { TutorialDoc } from "../examples/tutorial.js";
import type { MdslDocument, ParseResult } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "fixtures");

function loadMarkdown(name: string): string {
  return readFileSync(join(fixtures, `${name}.md`), "utf8");
}

function assertCleanParse<T>(
  result: ParseResult<T>,
): asserts result is ParseResult<T> & { data: T } {
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.data).not.toBeNull();
}

const cases: Array<{ name: string; doc: MdslDocument<unknown>; fixture: string }> = [
  { name: "spec-doc", doc: SpecDoc, fixture: "spec-doc" },
  { name: "runbook", doc: Runbook, fixture: "runbook" },
  { name: "incident-postmortem", doc: IncidentPostmortem, fixture: "incident-postmortem" },
  { name: "tutorial", doc: TutorialDoc, fixture: "tutorial" },
];

describe("round-trip", () => {
  it.each(cases)("$name: md → json → md → json", ({ doc, fixture }) => {
    const markdown = loadMarkdown(fixture);
    const first = doc.parse(markdown);
    assertCleanParse(first);

    const reserialized = doc.serialize(first.data);
    const second = doc.parse(reserialized);
    assertCleanParse(second);

    expect(second.data).toEqual(first.data);
  });

  it.each(cases)("$name: json → md → json", ({ doc, fixture }) => {
    const markdown = loadMarkdown(fixture);
    const initial = doc.parse(markdown);
    assertCleanParse(initial);
    const json = initial.data;

    const generated = doc.serialize(json);
    const reparsed = doc.parse(generated);
    assertCleanParse(reparsed);

    expect(reparsed.data).toEqual(json);
  });

  it("serialize → parse accepts validate() output shape", () => {
    const initial = SpecDoc.parse(loadMarkdown("spec-doc"));
    assertCleanParse(initial);

    const validated = SpecDoc.validate(initial.data);
    assertCleanParse(validated);

    const markdown = SpecDoc.serialize(validated.data);
    const reparsed = SpecDoc.parse(markdown);
    assertCleanParse(reparsed);

    expect(reparsed.data).toEqual(validated.data);
  });
});
