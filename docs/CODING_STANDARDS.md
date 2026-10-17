# Coding standards

Apply these rules during user-requested code reviews. Reject oxlint ignore comments used to bypass lint; require a code fix or restructure.

When the diff touches `convex/`, read [convex-three-layers.md](./convex-three-layers.md) for layer ownership and [convex-neverthrow-review.md](./convex-neverthrow-review.md) for error-handling checks before reviewing.

### Preserving long-term maintainability of the codebase

- Push for restructuring the codebase to remove complexity instead of making bandaid fixes or making the fast, easy fix/refactor
    - e.g. weird wrappers functions, preserving existing bad patterns
    - Look for opportunities to reframe the change so that whole branches, helpers, modes, conditionals, or layers disappear entirely.
    - **Question the threading.** If a task asks you to pass a new signal through types, schemas, pipelines, or similar layers, stop and look for a more direct path.
    - **Sweat the small leaks.** Remove tiny pass-throughs, representation leaks, and duplicated choices before they spread. Small leaks compound into permanent coordination costs.
    - **Prefer deletion.** When asked to refactor or improve, look for removals before additions.
    - **Maintain a flat call hierarchy.** Avoid deep call chains. A rich interface that hides substantial work is not a deep call chain. If answering a question requires tracing through more than 3 files or layers, flatten it.

## Naming and components

- Use `PascalCase.tsx` for React component files and `PascalCase` for type names.
- Extract major or self-contained UI sections into separate component files.
- Group related React setup and state with short section comments.
- Add a short comment before each `useEffect` explaining what it does.

## Tailwind

- Avoid arbitrary values such as `clamp`, `min(...)`, custom pixel brackets, and custom breakpoints.
- Use theme-token colors such as background, foreground, and primary instead of standard palette colors.
- Avoid classes already supplied by the parent component.
- Loading states need an animated spinner icon and a concise label such as `Saving`, without trailing ellipses.

## Helpers and modules

Check every added or changed helper, including private functions and inline callbacks, for responsibility, layer, name, and benefit to callers. Report all findings. Passing lint does not establish that placement, naming, or extraction is sound.

For Convex, put pure calculations, formatting, draft transformations, and checks on supplied values in the nearest feature/shared `lib/`, even with one caller. Permission workflows and service calls stay in services.

- Check for a similar existing helper before adding one.
- Name values for what they represent and functions for what they accomplish.
- Reject pass-through wrappers, inline return arrows, barrel files, and factory helpers. Restructure with hooks, components, or `lib/` modules.
- Each extraction must own meaningful work. Undo splits that only forward arguments or reconnect other splits. Keep internal representations behind module interfaces.
- Put reusable helpers, constants, and mappers in the nearest appropriate `lib/` file instead of components, routes, or backend functions.

## Comments

- Explain complex or long functions and conditionals with simple comments.
- Preserve comments during refactors; update them when behavior changes.

## TypeScript

- Reject nested `if` statements.
- Use discriminated unions for app state so boolean flags and optional fields cannot allow invalid combinations.
- Handle every union variant with an `exhaustiveCheck` default.
- Parse boundary data once with Zod.
- Express internal contracts with types instead of untyped dictionaries or redundant runtime checks.

## Tests

Before reviewing added or changed tests, read the [tests skill](../.agents/skills/tests/SKILL.md) for test admission, module interfaces, and mocking conventions.
