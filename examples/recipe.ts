import { z } from 'zod';
import { document, frontmatter, section, prose, codeBlock, list, table, formatDiagnostics } from '../src/index.js';

// ── Schema definition ─────────────────────────────────────────────────────────

const RecipeDoc = document({
  meta: frontmatter(
    z.object({
      title: z.string().describe('Recipe name'),
      author: z.string().describe('Who wrote the recipe'),
      servings: z.number().describe('Number of servings'),
      prepTime: z.string().describe('Preparation time, e.g. "15 minutes"'),
    }),
  ),
  intro: section('Introduction', {
    body: prose(),
  }),
  ingredients: section('Ingredients', {
    items: list(z.string().describe('An ingredient with quantity')),
  }),
  instructions: section('Instructions', {
    steps: list(z.string().describe('A single cooking step')),
    tip: codeBlock('tip'),
  }),
  nutrition: section('Nutrition', {
    rows: table(
      z.object({
        nutrient: z.string(),
        per_serving: z.string(),
        daily_value: z.string(),
      }).describe('A nutrition fact row'),
    ),
  }),
});

type Recipe = typeof RecipeDoc extends { parse: (md: string) => { data: infer T } } ? T : never;

// ── Sample markdown document ──────────────────────────────────────────────────

const MARKDOWN = `---
title: "Spaghetti Carbonara"
author: "Chef"
servings: 2
prepTime: "20 minutes"
---

## Introduction

A classic Roman pasta dish made with eggs, Pecorino Romano, guanciale, and black pepper.
No cream needed — the magic is in the emulsification.

## Ingredients

- 200g spaghetti
- 100g guanciale, diced
- 2 large eggs
- 50g Pecorino Romano, finely grated
- Black pepper to taste
- Salt for pasta water

## Instructions

- Boil a large pot of heavily salted water and cook spaghetti until al dente.
- Fry guanciale in a dry pan over medium heat until golden and crispy.
- Whisk eggs with most of the Pecorino and a generous amount of black pepper.
- Drain pasta, reserving a cup of pasta water, and toss immediately with the guanciale off the heat.
- Add egg mixture and toss vigorously, adding pasta water a splash at a time to form a creamy sauce.
- Serve topped with remaining Pecorino and more black pepper.

\`\`\`tip
Take the pan off the heat before adding eggs — residual heat is all you need.
Scrambled carbonara is a tragedy.
\`\`\`

## Nutrition

| nutrient | per_serving | daily_value |
| --- | --- | --- |
| Calories | 680kcal | 34% |
| Protein | 28g | 56% |
| Carbohydrates | 72g | 26% |
| Fat | 30g | 43% |
`;

// ── Run the example ───────────────────────────────────────────────────────────

console.log('='.repeat(60));
console.log('1. PARSING');
console.log('='.repeat(60));

const result = RecipeDoc.parse(MARKDOWN);

console.log('\nDiagnostics:', result.diagnostics.length === 0
  ? '✓ None'
  : '\n' + formatDiagnostics(result.diagnostics));

console.log('\nParsed model:');
console.log(JSON.stringify(result.data, null, 2));

console.log('\n' + '='.repeat(60));
console.log('2. SERIALISE → RE-PARSE ROUND-TRIP');
console.log('='.repeat(60));

const serialized = RecipeDoc.serialize(result.data!);
console.log('\nSerialized markdown:\n');
console.log(serialized);

const reparsed = RecipeDoc.parse(serialized);
console.log('Round-trip diagnostics:', reparsed.diagnostics.length === 0 ? '✓ None' : formatDiagnostics(reparsed.diagnostics));
console.log('Title matches:', reparsed.data!.meta.title === result.data!.meta.title ? '✓' : '✗');

console.log('\n' + '='.repeat(60));
console.log('3. JSON SCHEMA (for LLM structured output)');
console.log('='.repeat(60));
console.log(JSON.stringify(RecipeDoc.toJsonSchema(), null, 2));

console.log('\n' + '='.repeat(60));
console.log('4. AUTHORING GUIDANCE');
console.log('='.repeat(60));
console.log(RecipeDoc.toGuidance());

console.log('\n' + '='.repeat(60));
console.log('5. EXAMPLE MARKDOWN');
console.log('='.repeat(60));
console.log(RecipeDoc.toExampleMarkdown());

console.log('\n' + '='.repeat(60));
console.log('6. DIAGNOSTIC DEMO (malformed document)');
console.log('='.repeat(60));

const badMarkdown = `---
title: "Oops"
author: "Someone"
servings: 2
prepTime: "5 min"
---

## Introduction

Missing the other three sections entirely.
`;

const badResult = RecipeDoc.parse(badMarkdown);
console.log('\n' + formatDiagnostics(badResult.diagnostics));
