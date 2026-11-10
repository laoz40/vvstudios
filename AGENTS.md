# AGENTS.md

## Project

Booking website for a podcast studio, plus an internal dashboard for admins to manage bookings.
Operational priorities: accessibility, fast first paint on marketing pages, SEO, mobile responsiveness

## Stack

- Bun
- Convex backend
- Default to shadcn for UI
- t3env for env variables

## Behaviour

- Ask before making assumptions that change behavior, UX, or architecture.
- Never use ignore comments to bypass the linter; fix or restructure instead.

- Do not run `build` unless asked.
- Do not start the dev server if one is already running.
- Do not start a long-running `convex dev`.

## Verify changes

- Match verification to risk: skip checks for non-functional edits (comments, docs, wording); use relevant checks for small, low-risk code changes (lint, format, typecheck). Run `bun run verify` after substantive changes and before PRs containing functional changes.
- Add `--convex` when Convex functions changed. Sync must finish before E2E.
- Run E2E immediately before creating a PR. Before selecting E2E flows, verifying browser behavior, or investigating failed CI checks, read the [verification skill](./.agents/skills/verify-vvstudios/SKILL.md) for commands, browser prerequisites, and evidence requirements.

## IMPORTANT: Code maintainability

- Push for restructuring the codebase to remove complexity instead of making bandaid fixes or making the fast, easy fix/refactor
  - NO useless wrappers functions, barrel files, factory helpers, duplicated functions
  - Look for opportunities to reframe the change so that whole branches, helpers, modes, conditionals, or layers disappear entirely.
  - Every extraction must own real responsibility. If it only forwards or reconnects code split, undo the split and restructure
  - Prefer deletion when asked to refactor or improve, look for removals before additions.
  - Keep call hierarchies flat. If answering a question requires tracing through more than three files or layers, flatten it. An interface that hides substantial work is not itself a deep call chain.
- When adding a new feature, always avoid feature creep and over-engineering
  - Reach for the simplest thing that works
  - Ask the user if there are potential edge cases before you implement fixes for them or build for hypothetical futures.
  - Don't automatically assume backwards compatibility, migrations, or backfills are needed. Check if the feature is actually in the main branch already
  - Do not to add unecessary fields to the db schema
  - Use YAGNI and DRY principles
  - Check for a similar existing helper before adding one.
  - Function names must be clear and simple what they do
  - Put pure calculations, formatting, draft transformations, and checks on supplied values in the nearest appropriate `lib/` file instead of components, routes, or backend functions.

## React

- This project uses React Compiler for automatic memoization. Avoid manual `useMemo` and `useCallback` unless there is a specific need.
- Keep React components focused on rendering and user interactions.
- Pass `useReducer`'s typed `dispatch` directly; avoid callback props that only wrap it.
- Prefer `useReducer` and explicit state machines, rather than implicit state machines
- Extract data fetching, reusable stateful logic, and external synchronisation into appropriately scoped hooks or modules.
- Prefer derived state and event handlers over effects.
- Only introduce effects when synchronising with external systems, and avoid abstractions that merely hide unnecessary effects.

## Tailwind

- Avoid arbitrary values such as `clamp`, `min(...)`, custom pixel brackets, and custom breakpoints.
- Use theme-token colors such as background, foreground, and primary instead of standard palette colors.
- Loading states need an animated spinner icon and a concise label such as `Saving`, without trailing ellipses.

## TypeScript

- Use discriminated unions for app state so boolean flags and optional fields cannot allow invalid combinations.
- Handle every union variant with an `exhaustiveCheck` default.
- Parse boundary data once with Zod, allow types to flow through the app.
- Express internal contracts with types instead of untyped dictionaries or redundant runtime checks.

## Convex

Before implementing, debugging, or reviewing code under `convex/`, including schemas, handlers, services, and lib, read the [project Convex guide](./docs/convex-three-layers.md). Before reviewing Convex changes, read the [error-handling checks](./docs/convex-neverthrow-review.md).

### Testing

- Read the [tests skill](./.agents/skills/tests/SKILL.md) before proposing new tests or updating existing tests.
- Don't write new tests. Instead record candidates in [test proposals](./docs/test-proposals.md) and continue implementation.

