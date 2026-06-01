# AGENTS.md

Booking website for podcast studio.

- bun
- typescript
- shadcn
- t3env for env vars
- bun

For Convex code, always read `convex/_generated/ai/guidelines.md` first for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

## File/Change Hygiene

- Do not add new dependencies unless needed for task
- Keep diffs small and task-focused
- Preserve existing architectural style.

- Before adding helper functions, check for lib files that have related logic
- Move reusable helper functions, formatting, validation, constants, and mappers into the nearest appropriate `lib` file instead of keeping them inside main component, route, or Convex function files
- Keep main Convex files focused on Convex API/database logic; put reusable business rules and validation in `convex/lib/*`
- Do not duplicate constants/defaults between frontend and Convex; extract shared values to one importable source when possible
- When a component grows into a distinct feature area, extract it into its own component file
- Keep feature component helpers in the feature `lib` directory when they are not purely presentational

- run format and lint once changes are complete
- do not run build

## Behavior

- Ask user before making assumptions that change behavior, UX, architecture
- Prioritize explicit user confirmation over inferred defaults
- If multiple valid options exist, ask user to choose instead of silently deciding
- one focused question at a time
- Only proceed without asking when request clear and action low-risk easily reversible
- be concise

## Code Style Guidelines

### Imports

- Prefer absolute imports
- Remove unused imports
- Sort imports by react, packages, components

### Components and pages

- compose feature components instead of putting large UI trees or business logic in `page.tsx`
- Extract major or self-contained UI sections into separate component files instead of growing a single large component file
- Prefer small, focused components with clear props
- Keep components mostly presentational; move reusable transforms, constants, validation, and formatting to feature `lib` files
- Always use shadcn/ui components by default, and unpic for images
- Avoid thin pass-through route/page/component files; inline small route-only UI and wrappers unless they are reused, stateful, substantial, or represent a clear domain concept.
- Avoid tiny helper files/functions for one-off logic; inline them unless they remove meaningful duplication, are reused, or isolate a clear business rule.

### Naming Conventions

- component files: `PascalCase.tsx`.
- Utility functions/variables: `camelCase`.
- Exported type names: `PascalCase`.

### TypeScript

- Prefer explicit exported types for component props and utility contracts
- Avoid `any`
- Do not use nested ternaries and patterns that make it harder to read the code

### Error handling

- Prefer typed error flows with narrow `code` values
- For Convex, throw `ConvexError` with structured `data.code` values and handle exact codes
- Re-throw known `ConvexError`s and map unknown server errors to safe app error codes
- Map codes by layer:
  - helper -> error code
  - route -> HTTP response/status
  - UI -> toast/message

### Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).
