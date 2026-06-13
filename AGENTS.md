# AGENTS.md

Booking website for podcast studio.

- bun
- default to shadcn for ui
- t3env

## File/Change Hygiene

- Before adding helper functions, check if they already exist
- Move reusable helpers, constants, mappers, and important app behavior rules into nearest appropriate `lib` file instead of keeping them inside
  components, routes, or backend functions.
- App behavior rules include things like permissions, statuses, validation, limits, and error mapping.
- Avoid tiny helper files/functions for one-off logic
- Optimize for readability and safe future changes over minimizing line count
- Keep functions small and focused on one decision or operation
- Prefer clear sequencing, guard clauses, and early returns over clever compact code
- Keep nesting shallow; avoid more than two levels of nested control flow
- Replace long `if`/`else if` chains and large inline booleans with named helpers or discriminated outcomes when clearer

- run format and lint once changes are complete
- do not run build or convex codegen

## Behavior

- Ask user before making assumptions that change behavior, UX, architecture
- Prioritize explicit user confirmation over inferred defaults
- Only proceed without asking when request clear and action low-risk easily reversible
- talk to me using simple language

## Code Style Guidelines

### Naming Conventions

- component files: `PascalCase.tsx`.
- Type names: `PascalCase`.

### Imports

- Prefer absolute imports
- Remove unused imports
- Sort imports by react, packages, components
- Don't export functions/types if not used

### Components and pages

- Extract major or self-contained UI sections into separate component files instead of growing a single large component file

### TypeScript

- Avoid `any`
- Do not use nested ternaries and if statements
- Use discriminated unions for app state. Avoid boolean flags and optional fields that allow invalid combinations.
- Handle every union variant. Use `never` in the default case to force exhaustive switches.
- Model expected failures as typed variants with a stable discriminator. Use `reason` for tuple `Result` errors.
- Treat boundary data as `unknown`: APIs, forms, storage, env vars, SDKs, URLs, and user input.
- Parse boundary data once with a runtime schema, such as Zod. Do not trust `as SomeType`.

### Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).
- Do not add classes that already exist in the component

### Convex

- For Convex code, always read `convex/_generated/ai/guidelines.md` first.
- Keep main Convex files focused on Convex API/database logic; put reusable business functions in `convex/lib/*`
- Do not duplicate constants/defaults between frontend and Convex; extract shared values to one importable source when possible
- Public/client-facing Convex functions should return tuple `Result<Success, Error>` for expected auth, validation, lookup, rate-limit, third-party, and write failures.
- Use `ok(...)`, `err(...)`, and `tryCatch(...)` from `src/lib/result.ts`.
- Expected failures return `err({ reason: "..." })`; unexpected invariant/developer failures may still throw.
- Use shared non-throwing helpers for expected auth and lookup failures, such as `getAdminIdentity`, `getBookingFromDb`, and `getBookingFromQuery`.
- Prefer inferred result types from handler returns, such as `Awaited<ReturnType<typeof handler>>`. Do not duplicate error-code unions unless needed.
- Client handlers should switch on `error.reason` exhaustively and keep one-off messages inline.
- Convex mutations commit when they return and roll back when they throw, so check expected failures before writes.
- Avoid returning `err(...)` after partial writes unless those writes should commit.
- Do not add temporary client-side `FunctionReference` casts for stale generated types. The user will run Convex codegen.
- If a named handler causes Convex to infer args as `EmptyObject`, keep the named handler but use an inline wrapper: `handler: (ctx, args) => namedHandler(ctx, args)`.
