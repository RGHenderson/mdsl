---
slug: getting-started-with-zod
difficulty: beginner
tags:
  - typescript
  - validation
---

# Getting started with Zod

![Zod logo](https://zod.dev/logo.svg "Zod — TypeScript-first schema validation")

## Introduction

![Zod logo](https://zod.dev/logo.svg "Zod — TypeScript-first schema validation")

Zod is a TypeScript-first schema declaration and validation library.
Define your schema once and get static types and runtime validation for free.

## Prerequisites

1. Node.js 18 or later
2. A TypeScript project with `strict: true`
3. Basic familiarity with TypeScript generics

## Step 1: Install

Install Zod from npm.

```ts
npm install zod
```

```ts
import { z } from "zod";
```

## Step 2: Define a schema

Create a schema for your data shape.

```ts
const UserSchema = z.object({
  name: z.string(),
  age: z.number().min(0),
  role: z.enum(["admin", "user"]),
});
```

## Step 3: Parse and validate

Use `.parse()` to validate and infer the type in one call.

```ts
const user = UserSchema.parse({ name: "Alice", age: 30, role: "admin" });
```

```ts
const result = UserSchema.safeParse(unknownData);
if (result.success) {
  console.log(result.data.name);
}
```

## Troubleshooting

### Problem

Use `.safeParse()` — it never throws.

### Problem

Make sure you use the output of `.parse()` or infer with `z.infer<typeof schema>`.
