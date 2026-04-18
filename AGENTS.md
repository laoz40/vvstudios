# AGENTS.md

Booking website for podcast studio.

- bun
- typescript
- t3env for env vars

For Convex code, always read `convex/_generated/ai/guidelines.md` first for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

## File/Change Hygiene

- Do not add new dependencies unless needed for task
- Keep diffs small and task-focused
- Preserve existing architectural style.
- bun run format and lint once changes are complete

## Behavior

- Ask user before making assumptions that change behavior, UX, architecture
- Prioritize explicit user confirmation over inferred defaults
- If multiple valid options exist, ask user to choose instead of silently deciding
- one focused question at a time
- Only proceed without asking when request clear and action low-risk easily reversible
- be as concise as possible, to conserve token usage

## Code Style Guidelines

### Imports

- Prefer absolute imports
- Remove unused imports
- Sort imports by react, packages, components

### Components and pages

- compose feature components instead of putting large UI trees or business logic in `page.tsx`
- Prefer small, focused components with clear props

### TypeScript

- Prefer explicit exported types for component props and utility contracts
- Avoid `any`

### Error handling

- Prefer typed error flows with narrow `code` values
- Use `neverthrow` for fallible app logic and handle results exhaustively
- For Convex, throw `ConvexError` with structured `data.code` values and handle exact codes
- Re-throw known `ConvexError`s and map unknown server errors to safe app error codes

### Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).

### Error handling

- Map codes by layer:
  - helper -> error code
  - route -> HTTP response/status
  - UI -> toast/message

- For Convex, throw `ConvexError` with structured `data.code` values and handle exact codes
- Re-throw known `ConvexError`s and map unknown server errors to safe app error codes
