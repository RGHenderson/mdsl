import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  document,
  frontmatter,
  section,
  prose,
  codeBlock,
  list,
  table,
  optional,
  defaultValue,
  compose,
  repeat,
  orderedList,
  codeBlocks,
  image,
  rule,
  createRegistry,
  formatDiagnostics,
  DiagnosticCodes,
  MdslError,
  generateExampleData,
} from "../src/index.js";

// ── Fixture schema ────────────────────────────────────────────────────────────

const RecipeDoc = document({
  meta: frontmatter(
    z.object({
      title: z.string().describe("Recipe title"),
      servings: z.number().describe("Number of servings"),
    }),
  ),
  overview: section("Overview", {
    body: prose(),
    snippet: codeBlock("bash"),
  }),
  ingredients: section("Ingredients", {
    items: list(z.string()),
  }),
  nutrition: section("Nutrition", {
    rows: table(z.object({ nutrient: z.string(), amount: z.string() })),
  }),
});

const SAMPLE_MARKDOWN = `---
title: "Pasta"
servings: 4
---

## Overview

A simple pasta dish.

\`\`\`bash
cook pasta
\`\`\`

## Ingredients

- Pasta
- Tomato sauce
- Basil

## Nutrition

| nutrient | amount |
| --- | --- |
| Calories | 400kcal |
| Protein | 12g |
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("parse", () => {
  it("parses a valid document with no diagnostics", () => {
    const result = RecipeDoc.parse(SAMPLE_MARKDOWN);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data).not.toBeNull();
    expect(result.data!.meta.title).toBe("Pasta");
    expect(result.data!.meta.servings).toBe(4);
  });

  it("parses section prose", () => {
    const result = RecipeDoc.parse(SAMPLE_MARKDOWN);
    expect(result.data!.overview.body).toContain("A simple pasta dish");
  });

  it("parses code block", () => {
    const result = RecipeDoc.parse(SAMPLE_MARKDOWN);
    expect(result.data!.overview.snippet).toBe("cook pasta");
  });

  it("parses list items", () => {
    const result = RecipeDoc.parse(SAMPLE_MARKDOWN);
    expect(result.data!.ingredients.items).toEqual(["Pasta", "Tomato sauce", "Basil"]);
  });

  it("parses table rows", () => {
    const result = RecipeDoc.parse(SAMPLE_MARKDOWN);
    expect(result.data!.nutrition.rows).toEqual([
      { nutrient: "Calories", amount: "400kcal" },
      { nutrient: "Protein", amount: "12g" },
    ]);
  });

  it("produces a diagnostic for a missing section", () => {
    const md = `---\ntitle: "X"\nservings: 1\n---\n\n## Overview\n\nHello\n\n\`\`\`bash\nok\n\`\`\`\n`;
    const result = RecipeDoc.parse(md);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain(DiagnosticCodes.MISSING_SECTION);
  });

  it("includes jsonPath in diagnostics", () => {
    const md = `---\ntitle: "X"\nservings: 1\n---\n\n## Overview\n\nHello\n\n\`\`\`bash\nok\n\`\`\`\n`;
    const result = RecipeDoc.parse(md);
    expect(result.diagnostics.some((d) => d.jsonPath.includes("ingredients"))).toBe(true);
  });

  it("includes mdLocation in diagnostics", () => {
    const md = `---\ntitle: "X"\nservings: 1\n---\n\n## Overview\n\nHello\n\n\`\`\`bash\nok\n\`\`\`\n`;
    const result = RecipeDoc.parse(md);
    for (const diag of result.diagnostics) {
      expect(diag.mdLocation).toHaveProperty("line");
      expect(diag.mdLocation).toHaveProperty("column");
    }
  });

  it("returns null data when parse has errors", () => {
    const md = `---\ntitle: "X"\nservings: 1\n---\n`;
    const result = RecipeDoc.parse(md);
    expect(result.data).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

describe("serialize", () => {
  it("serializes a model back to markdown", () => {
    const result = RecipeDoc.parse(SAMPLE_MARKDOWN);
    expect(result.data).not.toBeNull();
    const out = RecipeDoc.serialize(result.data!);
    expect(out).toContain("---");
    expect(out).toContain("title:");
    expect(out).toContain("## Overview");
    expect(out).toContain("## Ingredients");
    expect(out).toContain("- Pasta");
  });
});

describe("round-trip", () => {
  it("parse → serialize → parse produces same data", () => {
    const first = RecipeDoc.parse(SAMPLE_MARKDOWN);
    expect(first.data).not.toBeNull();
    const serialized = RecipeDoc.serialize(first.data!);
    const second = RecipeDoc.parse(serialized);
    expect(second.data).not.toBeNull();
    expect(second.data!.meta.title).toBe(first.data!.meta.title);
    expect(second.data!.meta.servings).toBe(first.data!.meta.servings);
    expect(second.data!.ingredients.items).toEqual(first.data!.ingredients.items);
    expect(second.data!.nutrition.rows).toEqual(first.data!.nutrition.rows);
  });
});

describe("toJsonSchema", () => {
  it("returns a valid JSON Schema object", () => {
    const schema = RecipeDoc.toJsonSchema();
    expect(schema).toHaveProperty("type", "object");
    expect(schema).toHaveProperty("properties");
  });
});

describe("toGuidance", () => {
  it("returns a non-empty string", () => {
    const guidance = RecipeDoc.toGuidance();
    expect(typeof guidance).toBe("string");
    expect(guidance.length).toBeGreaterThan(0);
    expect(guidance).toContain("Overview");
  });
});

describe("toExampleMarkdown", () => {
  it("returns a non-empty string", () => {
    const example = RecipeDoc.toExampleMarkdown();
    expect(typeof example).toBe("string");
    expect(example.length).toBeGreaterThan(0);
  });

  it("produces a parseable document", () => {
    const example = RecipeDoc.toExampleMarkdown();
    // Should at least parse without crashing
    expect(() => RecipeDoc.parse(example)).not.toThrow();
  });
});

describe("registry", () => {
  it("detects and parses a document by frontmatter type", () => {
    const registry = createRegistry();
    registry.register(RecipeDoc, (ctx) => ctx.frontmatter?.["type"] === "recipe");

    const md = `---\ntype: recipe\ntitle: "Soup"\nservings: 2\n---\n\n## Overview\n\nSoup.\n\n\`\`\`bash\nboil\n\`\`\`\n\n## Ingredients\n\n- Water\n\n## Nutrition\n\n| nutrient | amount |\n| --- | --- |\n| Calories | 50kcal |\n`;
    const result = registry.parse(md);
    expect(result).not.toBeNull();
    expect((result!.data as { meta: { title: string } }).meta.title).toBe("Soup");
  });

  it("returns null when no schema matches", () => {
    const registry = createRegistry();
    registry.register(RecipeDoc, (ctx) => ctx.frontmatter?.["type"] === "recipe");
    expect(registry.parse("# Hello\n\nNo match.\n")).toBeNull();
  });

  it("detects by heading presence", () => {
    const registry = createRegistry();
    registry.register(RecipeDoc, (ctx) =>
      ctx.headings.some((h) => h.toLowerCase() === "ingredients"),
    );
    const result = registry.parse(SAMPLE_MARKDOWN);
    expect(result).not.toBeNull();
  });
});

describe("formatDiagnostics", () => {
  it("formats diagnostics as readable text", () => {
    const md = `---\ntitle: "X"\nservings: 1\n---\n`;
    const result = RecipeDoc.parse(md);
    const formatted = formatDiagnostics(result.diagnostics);
    expect(formatted).toContain("ERROR");
    expect(formatted).toContain("Line");
  });

  it("returns no-diagnostics message when empty", () => {
    expect(formatDiagnostics([])).toBe("No diagnostics.");
  });
});

// ── New feature tests ─────────────────────────────────────────────────────────

describe("DiagnosticCodes", () => {
  it("exports stable string constants", () => {
    expect(DiagnosticCodes.MISSING_SECTION).toBe("MISSING_SECTION");
    expect(DiagnosticCodes.AMBIGUOUS_SECTION).toBe("AMBIGUOUS_SECTION");
    expect(DiagnosticCodes.ZOD_VALIDATION).toBe("ZOD_VALIDATION");
    expect(DiagnosticCodes.MISSING_LIST).toBe("MISSING_LIST");
  });

  it("diagnostic codes match constants", () => {
    const md = `---\ntitle: "X"\nservings: 1\n---\n`;
    const result = RecipeDoc.parse(md);
    for (const d of result.diagnostics) {
      expect(Object.values(DiagnosticCodes)).toContain(d.code);
    }
  });
});

describe("strict mode", () => {
  it("throws MdslError when strict: true and errors present", () => {
    const md = `---\ntitle: "X"\nservings: 1\n---\n`;
    expect(() => RecipeDoc.parse(md, { strict: true })).toThrow(MdslError);
  });

  it("MdslError carries diagnostics", () => {
    const md = `---\ntitle: "X"\nservings: 1\n---\n`;
    let caught: unknown;
    try {
      RecipeDoc.parse(md, { strict: true });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MdslError);
    expect((caught as MdslError).diagnostics.length).toBeGreaterThan(0);
  });

  it("does not throw when no errors", () => {
    expect(() => RecipeDoc.parse(SAMPLE_MARKDOWN, { strict: true })).not.toThrow();
  });
});

describe("validate()", () => {
  it("validates correct data with no diagnostics", () => {
    const { data } = RecipeDoc.parse(SAMPLE_MARKDOWN);
    const result = RecipeDoc.validate(data);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("returns diagnostics for invalid data without needing markdown", () => {
    const result = RecipeDoc.validate({ meta: { title: 123 } });
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.code).toBe(DiagnosticCodes.ZOD_VALIDATION);
  });
});

describe("AMBIGUOUS_SECTION", () => {
  it("emits AMBIGUOUS_SECTION when heading appears twice", () => {
    const md = `---
title: "Pasta"
servings: 2
---

## Overview

First instance.

\`\`\`bash
cmd
\`\`\`

## Overview

Second instance.

\`\`\`bash
cmd2
\`\`\`

## Ingredients

- Pasta

## Nutrition

| nutrient | amount |
| --- | --- |
| Cal | 400 |
`;
    const result = RecipeDoc.parse(md);
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.AMBIGUOUS_SECTION)).toBe(true);
  });
});

describe("optional()", () => {
  const DocWithOptional = document({
    meta: frontmatter(z.object({ title: z.string() })),
    notes: optional(section("Notes", { body: prose() })),
  });

  it("returns undefined when optional section is missing", () => {
    const md = `---\ntitle: "X"\n---\n`;
    const result = DocWithOptional.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.notes).toBeUndefined();
  });

  it("extracts when optional section is present", () => {
    const md = `---\ntitle: "X"\n---\n\n## Notes\n\nSome notes here.\n`;
    const result = DocWithOptional.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.notes?.body).toContain("Some notes here");
  });
});

describe("defaultValue()", () => {
  const DocWithDefault = document({
    meta: frontmatter(z.object({ title: z.string() })),
    notes: defaultValue(section("Notes", { body: prose() }), { body: "No notes provided." }),
  });

  it("returns fallback when section is missing", () => {
    const md = `---\ntitle: "X"\n---\n`;
    const result = DocWithDefault.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.notes).toEqual({ body: "No notes provided." });
  });

  it("returns real value when section is present", () => {
    const md = `---\ntitle: "X"\n---\n\n## Notes\n\nActual notes.\n`;
    const result = DocWithDefault.parse(md);
    expect(result.data!.notes.body).toContain("Actual notes");
  });
});

describe("compose()", () => {
  const DocWithCompose = document({
    meta: frontmatter(z.object({ title: z.string() })),
    snippet: compose(codeBlock("typescript"), codeBlock()),
  });

  it("uses first matching extractor (typescript block)", () => {
    const md = `---\ntitle: "X"\n---\n\n\`\`\`typescript\nconst x = 1;\n\`\`\`\n`;
    const result = DocWithCompose.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.snippet).toContain("const x");
  });

  it("falls back to second extractor when first fails", () => {
    const md = `---\ntitle: "X"\n---\n\n\`\`\`python\nprint("hi")\n\`\`\`\n`;
    const result = DocWithCompose.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.snippet).toContain("print");
  });

  it("emits COMPOSE_FAILED when no extractor matches", () => {
    const md = `---\ntitle: "X"\n---\n`;
    const result = DocWithCompose.parse(md);
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.COMPOSE_FAILED)).toBe(true);
  });
});

describe("repeat()", () => {
  const SprintDoc = document({
    meta: frontmatter(z.object({ project: z.string() })),
    sprints: repeat("Sprint", {
      goal: prose(),
      tasks: list(z.string()),
    }),
  });

  const md = `---
project: "MyApp"
---

## Sprint

Build login.

- Implement auth
- Write tests

## Sprint

Build dashboard.

- Create charts
- Add filters
`;

  it("collects multiple same-heading sections as array", () => {
    const result = SprintDoc.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.sprints).toHaveLength(2);
  });

  it("extracts fields from each occurrence", () => {
    const result = SprintDoc.parse(md);
    expect(result.data!.sprints[0]!.goal).toContain("login");
    expect(result.data!.sprints[1]!.goal).toContain("dashboard");
    expect(result.data!.sprints[0]!.tasks).toContain("Implement auth");
  });

  it("round-trips through serialize", () => {
    const { data } = SprintDoc.parse(md);
    expect(data).not.toBeNull();
    const serialized = SprintDoc.serialize(data!);
    const reparsed = SprintDoc.parse(serialized);
    expect(reparsed.data!.sprints).toHaveLength(2);
    expect(reparsed.data!.sprints[0]!.tasks).toEqual(data!.sprints[0]!.tasks);
  });
});

describe("generateExampleData", () => {
  it("generates type-correct values from a schema", () => {
    const schema = z.object({
      name: z.string().describe("Full name"),
      count: z.number(),
      active: z.boolean(),
      tags: z.array(z.string()),
    });
    const data = generateExampleData(schema) as Record<string, unknown>;
    expect(typeof data.name).toBe("string");
    expect(typeof data.count).toBe("number");
    expect(typeof data.active).toBe("boolean");
    expect(Array.isArray(data.tags)).toBe(true);
  });

  it("uses description as string example value", () => {
    const schema = z.object({ city: z.string().describe("London") });
    const data = generateExampleData(schema) as Record<string, unknown>;
    expect(data.city).toBe("London");
  });
});

describe("toMarkdownTemplate", () => {
  it("returns a string with placeholder tokens", () => {
    const template = RecipeDoc.toMarkdownTemplate();
    expect(template).toContain("<");
    expect(template).toContain("## Overview");
  });
});

describe("toLlmJsonSchema", () => {
  it("returns a JSON Schema with mapping hints in descriptions", () => {
    const schema = RecipeDoc.toLlmJsonSchema() as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.meta!.description).toContain("Frontmatter");
    expect(props.overview!.description).toContain("Section");
  });
});

describe("toLlmGuide", () => {
  it("returns all expected bundle keys", () => {
    const guide = RecipeDoc.toLlmGuide();
    expect(guide).toHaveProperty("jsonSchema");
    expect(guide).toHaveProperty("llmJsonSchema");
    expect(guide).toHaveProperty("exampleJson");
    expect(guide).toHaveProperty("exampleMarkdown");
    expect(guide).toHaveProperty("template");
    expect(guide).toHaveProperty("guidance");
    expect(guide).toHaveProperty("systemPrompt");
    expect(guide).toHaveProperty("mappingHints");
    expect(guide).toHaveProperty("instructions");
  });

  it("systemPrompt is a non-empty string", () => {
    const { systemPrompt } = RecipeDoc.toLlmGuide();
    expect(typeof systemPrompt).toBe("string");
    expect(systemPrompt.length).toBeGreaterThan(100);
  });
});

// ── .refine() validation API ──────────────────────────────────────────────────

describe("document.refine()", () => {
  const ValidatedDoc = document({
    meta: frontmatter(z.object({ title: z.string(), servings: z.number() })),
    overview: section("Overview", { body: prose() }),
    ingredients: section("Ingredients", { items: list(z.string()) }),
  }).refine((data, { error, warning }) => {
    if (data.ingredients.items.length === 0) {
      error("ingredients.items", "Recipe must have at least one ingredient");
    }
    if (data.meta.servings > 100) {
      warning("meta.servings", "Unusually high serving count");
    }
  });

  const validMd = `---
title: "Soup"
servings: 4
---

## Overview

A simple soup.

## Ingredients

- Salt
- Water
`;

  it("passes when validator raises no issues", () => {
    const result = ValidatedDoc.parse(validMd);
    expect(result.data).not.toBeNull();
    expect(result.diagnostics).toHaveLength(0);
  });

  it("reports error from validator and still returns data", () => {
    const withError = document({
      meta: frontmatter(z.object({ title: z.string(), servings: z.number() })),
      overview: section("Overview", { body: prose() }),
      ingredients: section("Ingredients", { items: list(z.string()) }),
    }).refine((data, { error }) => {
      if (data.ingredients.items.length > 0) {
        error("ingredients.items", "Forced error for test");
      }
    });
    const result = withError.parse(validMd);
    // Validator errors do not null data — the model is structurally valid
    expect(result.data).not.toBeNull();
    const diag = result.diagnostics.find((d) => d.jsonPath === "ingredients.items");
    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("error");
    expect(diag!.message).toBe("Forced error for test");
    expect(diag!.code).toBe(DiagnosticCodes.VALIDATION_ERROR);
  });

  it("reports warning from validator without nulling data", () => {
    const withWarning = document({
      meta: frontmatter(z.object({ title: z.string(), servings: z.number() })),
      overview: section("Overview", { body: prose() }),
      ingredients: section("Ingredients", { items: list(z.string()) }),
    }).refine((data, { warning }) => {
      warning("meta.servings", "Test warning");
    });
    const result = withWarning.parse(validMd);
    expect(result.data).not.toBeNull();
    const diag = result.diagnostics.find((d) => d.jsonPath === "meta.servings");
    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("warning");
  });

  it("does not run validators when structural parse fails", () => {
    const calls: string[] = [];
    const doc = document({
      meta: frontmatter(z.object({ title: z.string(), servings: z.number() })),
      overview: section("Overview", { body: prose() }),
      ingredients: section("Ingredients", { items: list(z.string()) }),
    }).refine((_data, { error }) => {
      calls.push("ran");
      error("meta", "should not be called");
    });
    // Missing required sections
    const result = doc.parse(`---\ntitle: "X"\nservings: 2\n---\n`);
    expect(result.data).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("chains multiple refine calls", () => {
    const doc = document({
      meta: frontmatter(z.object({ title: z.string(), servings: z.number() })),
      overview: section("Overview", { body: prose() }),
      ingredients: section("Ingredients", { items: list(z.string()) }),
    })
      .refine((_data, { warning }) => {
        warning("meta.title", "first");
      })
      .refine((_data, { warning }) => {
        warning("meta.servings", "second");
      });
    const result = doc.parse(validMd);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0]!.message).toBe("first");
    expect(result.diagnostics[1]!.message).toBe("second");
  });

  it("also runs validators in validate()", () => {
    const doc = document({
      meta: frontmatter(z.object({ title: z.string(), servings: z.number() })),
      overview: section("Overview", { body: prose() }),
      ingredients: section("Ingredients", { items: list(z.string()) }),
    }).refine((_data, { error }) => {
      error("meta.title", "validator ran");
    });
    const data = {
      meta: { title: "X", servings: 1 },
      overview: { body: "ok" },
      ingredients: { items: ["x"] },
    };
    const result = doc.validate(data);
    const diag = result.diagnostics.find((d) => d.message === "validator ran");
    expect(diag).toBeDefined();
  });
});

// ── .or() fluent alternation ──────────────────────────────────────────────────

describe("node.or()", () => {
  const OrDoc = document({
    meta: frontmatter(z.object({ title: z.string() })),
    body: section("Body", {
      content: codeBlock("typescript").or(codeBlock("ts")).or(codeBlock()),
    }),
  });

  it("uses the first matching alternative (typescript)", () => {
    const md = `---\ntitle: "T"\n---\n\n## Body\n\n\`\`\`typescript\nconst x = 1;\n\`\`\`\n`;
    const result = OrDoc.parse(md);
    expect(result.data).not.toBeNull();
    expect(result.data!.body.content).toBe("const x = 1;");
  });

  it("falls back to second alternative (ts)", () => {
    const md = `---\ntitle: "T"\n---\n\n## Body\n\n\`\`\`ts\nconst y = 2;\n\`\`\`\n`;
    const result = OrDoc.parse(md);
    expect(result.data).not.toBeNull();
    expect(result.data!.body.content).toBe("const y = 2;");
  });

  it("falls back to bare code block", () => {
    const md = `---\ntitle: "T"\n---\n\n## Body\n\n\`\`\`\nplain\n\`\`\`\n`;
    const result = OrDoc.parse(md);
    expect(result.data).not.toBeNull();
    expect(result.data!.body.content).toBe("plain");
  });

  it("emits COMPOSE_FAILED when no alternative matches", () => {
    const strict = document({
      meta: frontmatter(z.object({ title: z.string() })),
      body: section("Body", {
        content: codeBlock("typescript").or(codeBlock("ts")),
      }),
    });
    const md = `---\ntitle: "T"\n---\n\n## Body\n\n\`\`\`python\npass\n\`\`\`\n`;
    const result = strict.parse(md);
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.COMPOSE_FAILED)).toBe(true);
  });

  it("is equivalent to compose()", () => {
    const withOr = document({
      meta: frontmatter(z.object({ title: z.string() })),
      body: section("Body", { content: prose().or(codeBlock()) }),
    });
    const withCompose = document({
      meta: frontmatter(z.object({ title: z.string() })),
      body: section("Body", { content: compose(prose(), codeBlock()) }),
    });
    const md = `---\ntitle: "T"\n---\n\n## Body\n\nSome text.\n`;
    expect(withOr.parse(md).data?.body.content).toBe(withCompose.parse(md).data?.body.content);
  });
});

// ── rule() named/reusable nodes ───────────────────────────────────────────────

describe("rule()", () => {
  const sharedIngredients = rule(
    "Shared Ingredients",
    section("Ingredients", { items: list(z.string()) }),
  );

  const RecipeWithRule = document({
    meta: frontmatter(z.object({ title: z.string() })),
    ingredients: sharedIngredients,
  });

  const AltRecipeWithRule = document({
    meta: frontmatter(z.object({ title: z.string(), servings: z.number() })),
    ingredients: sharedIngredients,
  });

  const validMd = `---\ntitle: "Soup"\n---\n\n## Ingredients\n\n- Water\n- Salt\n`;

  it("parses identically to the unwrapped node", () => {
    const plain = document({
      meta: frontmatter(z.object({ title: z.string() })),
      ingredients: section("Ingredients", { items: list(z.string()) }),
    });
    const ruleResult = RecipeWithRule.parse(validMd);
    const plainResult = plain.parse(validMd);
    expect(ruleResult.data).toEqual(plainResult.data);
  });

  it("can be reused in multiple documents", () => {
    const r1 = RecipeWithRule.parse(validMd);
    const altMd = `---\ntitle: "Stew"\nservings: 4\n---\n\n## Ingredients\n\n- Beef\n- Carrots\n`;
    const r2 = AltRecipeWithRule.parse(altMd);
    expect(r1.data!.ingredients.items).toEqual(["Water", "Salt"]);
    expect(r2.data!.ingredients.items).toEqual(["Beef", "Carrots"]);
  });

  it("annotates diagnostics with the rule name", () => {
    const badMd = `---\ntitle: "Oops"\n---\n`;
    const result = RecipeWithRule.parse(badMd);
    const diag = result.diagnostics.find((d) => d.jsonPath === "ingredients");
    expect(diag).toBeDefined();
    expect(diag!.mapping).toContain("Shared Ingredients");
  });

  it("carries the rule name through to mapping hints in LLM schema", () => {
    const schema = RecipeWithRule.toLlmJsonSchema() as {
      properties: Record<string, { description?: string }>;
    };
    expect(schema.properties["ingredients"]?.description).toContain("Shared Ingredients");
  });
});

// ── Nested sections ───────────────────────────────────────────────────────────

describe("nested sections", () => {
  const Doc = document({
    chapter: section("Chapter", {
      intro: prose(),
      sub: section("Details", { body: prose(), items: list(z.string()) }, 3),
    }),
  });

  const md = [
    "## Chapter",
    "",
    "Chapter intro.",
    "",
    "### Details",
    "",
    "Details body.",
    "",
    "- item one",
    "- item two",
  ].join("\n");

  it("parses nested section without bleeding intro prose", () => {
    const result = Doc.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.chapter.intro).toBe("Chapter intro.");
    expect(result.data!.chapter.sub.body).toBe("Details body.");
    expect(result.data!.chapter.sub.items).toEqual(["item one", "item two"]);
  });

  it("round-trips nested sections cleanly", () => {
    const result = Doc.parse(md);
    expect(result.data).not.toBeNull();
    const serialized = Doc.serialize(result.data!);
    const reparsed = Doc.parse(serialized);
    expect(reparsed.diagnostics).toHaveLength(0);
    expect(reparsed.data!.chapter.intro).toBe(result.data!.chapter.intro);
    expect(reparsed.data!.chapter.sub.items).toEqual(result.data!.chapter.sub.items);
  });

  it("reports missing nested section", () => {
    const noSub = "## Chapter\n\nChapter intro.\n";
    const result = Doc.parse(noSub);
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.MISSING_SECTION)).toBe(true);
  });
});

// ── section() nameField ───────────────────────────────────────────────────────

describe("section() nameField", () => {
  const Doc = document({
    sprint: section(/sprint \d+/i, { body: prose() }, 2, { nameField: "title" }),
  });

  it("captures the actual heading text", () => {
    const result = Doc.parse("## Sprint 42\n\nContent.\n");
    expect(result.data!.sprint.title).toBe("Sprint 42");
    expect(result.data!.sprint.body).toBe("Content.");
  });

  it("round-trips with the captured heading text", () => {
    const result = Doc.parse("## Sprint 42\n\nContent.\n");
    const serialized = Doc.serialize(result.data!);
    expect(serialized).toContain("## Sprint 42");
    const reparsed = Doc.parse(serialized);
    expect(reparsed.data!.sprint.title).toBe("Sprint 42");
  });

  it("also works with a literal string heading", () => {
    const D = document({
      intro: section("Introduction", { body: prose() }, 2, { nameField: "heading" }),
    });
    const result = D.parse("## Introduction\n\nHello.\n");
    expect(result.data!.intro.heading).toBe("Introduction");
  });
});

// ── blockquote() ──────────────────────────────────────────────────────────────

import { blockquote } from "../src/index.js";

describe("blockquote()", () => {
  const Doc = document({
    note: section("Note", {
      callout: blockquote(),
      body: prose(),
    }),
  });

  const md = "## Note\n\n> This is important!\n\nSome prose.\n";

  it("parses blockquote content", () => {
    const result = Doc.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.note.callout).toBe("This is important!");
    expect(result.data!.note.body).toBe("Some prose.");
  });

  it("serializes with > prefix", () => {
    const result = Doc.parse(md);
    const serialized = Doc.serialize(result.data!);
    expect(serialized).toContain("> This is important!");
  });

  it("round-trips cleanly", () => {
    const result = Doc.parse(md);
    const reparsed = Doc.parse(Doc.serialize(result.data!));
    expect(reparsed.data!.note.callout).toBe(result.data!.note.callout);
    expect(reparsed.data!.note.body).toBe(result.data!.note.body);
  });

  it("emits MISSING_BLOCKQUOTE when absent", () => {
    const result = Doc.parse("## Note\n\nNo blockquote here.\n");
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.MISSING_BLOCKQUOTE)).toBe(
      true,
    );
  });

  it("works as optional", () => {
    const D = document({
      note: section("Note", { callout: optional(blockquote()), body: prose() }),
    });
    const result = D.parse("## Note\n\nJust prose.\n");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.note.callout).toBeUndefined();
  });
});

// ── Zod transforms in list() and table() ──────────────────────────────────────

describe("Zod transforms", () => {
  describe("list() with type-changing transform", () => {
    const Doc = document({
      items: section("Items", {
        tags: list(
          z.string().transform((s) => ({ label: s, slug: s.toLowerCase().replace(/\s+/g, "-") })),
        ),
      }),
    });

    const md = "## Items\n\n- Hello World\n- Foo Bar\n";

    it("applies transform and returns structured objects", () => {
      const result = Doc.parse(md);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.data!.items.tags).toEqual([
        { label: "Hello World", slug: "hello-world" },
        { label: "Foo Bar", slug: "foo-bar" },
      ]);
    });

    it("still reports validation errors with line numbers", () => {
      const StrictDoc = document({
        items: section("Items", {
          nums: list(z.string().refine((s) => /^\d+$/.test(s), { message: "must be numeric" })),
        }),
      });
      const result = StrictDoc.parse("## Items\n\n- 123\n- abc\n");
      expect(result.diagnostics.some((d) => d.message === "must be numeric")).toBe(true);
      expect(
        result.diagnostics.find((d) => d.message === "must be numeric")?.mdLocation.line,
      ).toBeGreaterThan(0);
    });
  });

  describe("table() with type-changing transform", () => {
    const Doc = document({
      scores: section("Scores", {
        rows: table(
          z
            .object({ name: z.string(), score: z.string() })
            .transform((r) => ({ name: r.name, score: Number(r.score) })),
        ),
      }),
    });

    const md = "## Scores\n\n| name | score |\n| --- | --- |\n| Alice | 95 |\n| Bob | 87 |\n";

    it("applies transform and coerces types", () => {
      const result = Doc.parse(md);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.data!.scores.rows).toEqual([
        { name: "Alice", score: 95 },
        { name: "Bob", score: 87 },
      ]);
    });

    it("still reports missing column errors with row position", () => {
      const StrictDoc = document({
        scores: section("Scores", {
          rows: table(z.object({ name: z.string(), value: z.string().min(1) })),
        }),
      });
      const result = StrictDoc.parse(
        "## Scores\n\n| name | extra |\n| --- | --- |\n| Alice | x |\n",
      );
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });
});

// ── blockquote() serialization ────────────────────────────────────────────────

describe("blockquote() serialization", () => {
  const Doc = document({ quote: section("Quote", { text: blockquote() }) });

  it("round-trips a single-line blockquote", () => {
    const md = "## Quote\n\n> Simple quote.\n";
    const { data } = Doc.parse(md);
    const out = Doc.serialize(data!);
    const second = Doc.parse(out);
    expect(second.data!.quote.text).toBe(data!.quote.text);
  });

  it("uses bare > for blank lines in multi-paragraph blockquote", () => {
    const md = "## Quote\n\n> First paragraph.\n>\n> Second paragraph.\n";
    const { data } = Doc.parse(md);
    expect(data).not.toBeNull();
    const out = Doc.serialize(data!);
    expect(out).toMatch(/^>$/m);
    expect(out).not.toMatch(/^> $/m);
  });
});

// ── regex heading serialization guard ────────────────────────────────────────

describe("regex heading serialization", () => {
  it("throws when serializing a section with regex heading and no nameField", () => {
    const Doc = document({ step: section(/^Step/, { body: prose() }) });
    const { data } = Doc.parse("## Step 1\n\nContent.\n");
    expect(data).not.toBeNull();
    expect(() => Doc.serialize(data!)).toThrow(/nameField/);
  });

  it("serializes a section correctly when nameField is provided", () => {
    const Doc = document({
      step: section(/^Step/, { body: prose() }, 2, { nameField: "stepName" }),
    });
    const { data } = Doc.parse("## Step 1\n\nContent.\n");
    expect(data!.step.stepName).toBe("Step 1");
    const out = Doc.serialize(data!);
    expect(out).toContain("## Step 1");
  });

  it("throws when serializing a repeat with regex heading and no nameField", () => {
    const Doc = document({ steps: repeat(/^Step/, { body: prose() }) });
    const { data } = Doc.parse("## Step 1\n\nA.\n\n## Step 2\n\nB.\n");
    expect(data).not.toBeNull();
    expect(() => Doc.serialize(data!)).toThrow(/nameField/);
  });
});

// ── image() ───────────────────────────────────────────────────────────────────

describe("image()", () => {
  const Doc = document({ figure: section("Figure", { img: image() }) });

  it("parses an image with alt and url", () => {
    const result = Doc.parse("## Figure\n\n![A cat](cat.png)\n");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.figure.img).toEqual({ alt: "A cat", url: "cat.png" });
  });

  it("parses an image with a title", () => {
    const result = Doc.parse('## Figure\n\n![A cat](cat.png "Fluffy")\n');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.figure.img.title).toBe("Fluffy");
  });

  it("errors when no image is present", () => {
    const result = Doc.parse("## Figure\n\nJust some prose.\n");
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.MISSING_IMAGE)).toBe(true);
  });

  it("serializes an image without title", () => {
    const out = Doc.serialize({ figure: { img: { alt: "A cat", url: "cat.png" } } });
    expect(out).toContain("![A cat](cat.png)");
  });

  it("serializes an image with title", () => {
    const out = Doc.serialize({
      figure: { img: { alt: "A cat", url: "cat.png", title: "Fluffy" } },
    });
    expect(out).toContain('![A cat](cat.png "Fluffy")');
  });

  it("round-trips through parse → serialize → parse", () => {
    const md = '## Figure\n\n![Diagram](arch.png "Architecture")\n';
    const first = Doc.parse(md);
    const second = Doc.parse(Doc.serialize(first.data!));
    expect(second.data!.figure.img).toEqual(first.data!.figure.img);
  });
});

// ── codeBlocks() ──────────────────────────────────────────────────────────────

describe("codeBlocks()", () => {
  const Doc = document({ examples: section("Examples", { blocks: codeBlocks("ts") }) });

  it("parses multiple matching code blocks into an array", () => {
    const md = "## Examples\n\n```ts\nconst a = 1;\n```\n\n```ts\nconst b = 2;\n```\n";
    const result = Doc.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.examples.blocks).toEqual(["const a = 1;", "const b = 2;"]);
  });

  it("filters out blocks with a different language", () => {
    const md = "## Examples\n\n```ts\nconst a = 1;\n```\n\n```js\nconsole.log()\n```\n";
    const result = Doc.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.examples.blocks).toEqual(["const a = 1;"]);
  });

  it("errors when no matching blocks exist", () => {
    const result = Doc.parse("## Examples\n\n```js\nconsole.log()\n```\n");
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.MISSING_CODE_BLOCK)).toBe(
      true,
    );
  });

  it("serializes all blocks separated by blank lines", () => {
    const out = Doc.serialize({ examples: { blocks: ["const a = 1;", "const b = 2;"] } });
    expect(out).toContain("```ts\nconst a = 1;\n```");
    expect(out).toContain("```ts\nconst b = 2;\n```");
  });

  it("round-trips through parse → serialize → parse", () => {
    const md = "## Examples\n\n```ts\nconst a = 1;\n```\n\n```ts\nconst b = 2;\n```\n";
    const first = Doc.parse(md);
    const second = Doc.parse(Doc.serialize(first.data!));
    expect(second.data!.examples.blocks).toEqual(first.data!.examples.blocks);
  });
});

// ── orderedList() ─────────────────────────────────────────────────────────────

describe("orderedList()", () => {
  const Doc = document({
    steps: section("Steps", { items: orderedList(z.string()) }),
  });

  it("parses a numbered list", () => {
    const result = Doc.parse("## Steps\n\n1. First\n2. Second\n3. Third\n");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.steps.items).toEqual(["First", "Second", "Third"]);
  });

  it("does not match an unordered list", () => {
    const result = Doc.parse("## Steps\n\n- First\n- Second\n");
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.MISSING_LIST)).toBe(true);
  });

  it("serializes with numbered markers", () => {
    const out = Doc.serialize({ steps: { items: ["Alpha", "Beta"] } });
    expect(out).toContain("1. Alpha");
    expect(out).toContain("2. Beta");
    expect(out).not.toContain("- Alpha");
  });

  it("round-trips through parse → serialize → parse", () => {
    const md = "## Steps\n\n1. First\n2. Second\n";
    const first = Doc.parse(md);
    const second = Doc.parse(Doc.serialize(first.data!));
    expect(second.data!.steps.items).toEqual(first.data!.steps.items);
  });
});

describe("list() with ordered: false", () => {
  it("does not match a numbered list", () => {
    const Doc = document({
      items: section("Items", { list: list(z.string(), { ordered: false }) }),
    });
    const result = Doc.parse("## Items\n\n1. One\n2. Two\n");
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.MISSING_LIST)).toBe(true);
  });
});

// ── repeat() minItems ─────────────────────────────────────────────────────────

describe("repeat() minItems option", () => {
  it("errors when no occurrences found with default minItems: 1", () => {
    const Doc = document({ steps: repeat("Step", { body: prose() }) });
    const result = Doc.parse("## Other\n\nHello.\n");
    expect(result.diagnostics.some((d) => d.code === DiagnosticCodes.MISSING_REPEAT_ITEMS)).toBe(
      true,
    );
  });

  it("does not error with zero occurrences when minItems: 0", () => {
    const Doc = document({ steps: repeat("Step", { body: prose() }, 2, { minItems: 0 }) });
    const result = Doc.parse("## Other\n\nHello.\n");
    expect(
      result.diagnostics.filter((d) => d.code === DiagnosticCodes.MISSING_REPEAT_ITEMS),
    ).toHaveLength(0);
    expect(result.data!.steps).toEqual([]);
  });

  it("returns found items normally when minItems: 0 and items exist", () => {
    const Doc = document({ steps: repeat("Step", { body: prose() }, 2, { minItems: 0 }) });
    const result = Doc.parse("## Step\n\nContent.\n");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.steps).toHaveLength(1);
  });
});

// ── repeat() field type inference ─────────────────────────────────────────────

describe("repeat() field type inference", () => {
  it("infers typed fields on repeat items", () => {
    const Doc = document({
      steps: repeat("Step", { body: prose(), code: optional(codeBlock()) }),
    });
    const md = "## Step\n\nDo this.\n\n## Step\n\nDo that.\n\n```\nhello\n```\n";
    const result = Doc.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    const first = result.data!.steps[0]!;
    // TypeScript infers steps as Array<{ body: string; code: string | undefined }>
    expect(typeof first.body).toBe("string");
    expect(first.code).toBeUndefined();
    const second = result.data!.steps[1]!;
    expect(second.code).toBe("hello");
  });

  it("infers nameField as a string property on each item", () => {
    const Doc = document({
      items: repeat(/^Item/, { body: prose() }, 2, { nameField: "title" }),
    });
    const md = "## Item One\n\nContent.\n\n## Item Two\n\nMore.\n";
    const result = Doc.parse(md);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data!.items[0]!.title).toBe("Item One");
    expect(result.data!.items[1]!.title).toBe("Item Two");
  });
});
