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
- do not run build

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
- Do not use nested ternaries and patterns that make it harder to read the code

### Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).
- Do not add classes that already exist in the component

### Convex

- For Convex code, always read `convex/_generated/ai/guidelines.md` first for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.
- Keep main Convex files focused on Convex API/database logic; put reusable business functions in `convex/lib/*`
- Do not duplicate constants/defaults between frontend and Convex; extract shared values to one importable source when possible

### Error handling

- Prefer typed error flows with narrow `code` values
- For Convex, throw `ConvexError` with structured `data.code` values and handle exact codes
- Re-throw known `ConvexError`s and map unknown server errors to safe app error codes
- Map codes by layer:
  - helper -> error code
  - route -> HTTP response/status
  - UI -> toast/message
