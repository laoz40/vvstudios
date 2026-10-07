# CODING_STANDARDS.md

Repository-specific rules for **reviewing** code (review subagent).

When the diff touches `convex/`, review against the **Convex** section in [AGENTS.md](../AGENTS.md), [convex-three-layers.md](./convex-three-layers.md), and [convex-neverthrow-review.md](./convex-neverthrow-review.md).

## Simplicity and structure

Writing code is cheap, which makes over-engineering easy. Counter it by borrowing a human maintainer's fatigue. Aim for the most result with the least code and complexity.

- **Prefer deletion.** When refactoring or improving, look for removals before additions.
- **Maintain a flat call hierarchy.** Avoid deep call chains. A rich interface that hides substantial work is not a deep call chain. If answering a question requires tracing through more than 3 files or layers, flatten it.
- **Consolidate decisions.** Do not repeat the same choice in several places. Put it behind one source of truth and pass the result as a simple flag.
- **Minimize the diff.** Make the smallest change that solves the problem. Fewer lines beat "elegant" boilerplate.
- **Question the threading.** If a task asks you to pass a new signal through types, schemas, pipelines, or similar layers, stop and look for a more direct path.
- **Sweat the small leaks.** Remove tiny pass-throughs, representation leaks, and duplicated choices before they spread. Small leaks compound into permanent coordination costs.

**Prime directive:** If a human developer would find the code exhausting to maintain, it is a bad solution. Be lazy. Stay simple.

## Naming

- React component files: `PascalCase.tsx`.
- Type names: `PascalCase`.

## Components and pages

- Extract major or self-contained UI sections into separate component files instead of growing a single large component file.
- Group related React setup/state in clear sections; use short section comments for each group.
- Add short comments before `useEffect` blocks that explain what the effect does.

## Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).
- Do not add classes that already exist on the parent component.
- For loading states, show an animated spinner icon alongside a concise state label (e.g. `Saving`), not a trailing-ellipsis label like `Saving...`.

## Helpers and modules

During review, account for every added or changed helper, including private functions and inline callbacks. For each, check its responsibility, layer, name, and whether callers gain anything from the extraction. Report all findings rather than stopping after one example.

For Convex changes, pure calculations, formatting, draft transformations, and checks on supplied values belong in the nearest `convex/lib/` module, even with only one caller. Services select and compose these steps and load their inputs. Keep permission workflows and calls to other services in services; moving a whole workflow into lib is not a placement fix. See [convex-three-layers.md](./convex-three-layers.md).

Judge names by what the value represents or the function accomplishes. A forwarding wrapper needs a concrete responsibility beyond passing arguments to another function. Lint covers syntactic patterns; passing lint does not establish that helper placement, naming, or extraction is sound.

- Before adding a helper, check whether a similar function already exists in the codebase.
- Do not add wrapper functions, inline return arrows, barrel files, or factory helpers. Restructure instead: split hooks, extract a component, or move logic into `lib/` files. If linting errors appear, the structure likely needs a cleaner shape.
- Every extraction must own real responsibility. If it only forwards or reconnects a split, undo the split and restructure.
- Move reusable helpers, constants, and mappers into the nearest appropriate `lib/` file instead of keeping them inside components, routes, or backend functions.

## Comments

- Annotate complex or long functions and conditionals with simple comments so the flow is easier to follow.
- Preserve existing comments during refactors; do not delete comments just because code moved.
- Update comments when behavior changes so they stay accurate.

## TypeScript

- Do not use nested `if` statements for branching.
- Use discriminated unions for app state. Avoid boolean flags and optional fields that allow invalid combinations.
- Handle every union variant with an `exhaustiveCheck` default.
- Parse boundary data once with Zod.
- Do not write TypeScript like Python (e.g. overuse of untyped dict-like objects, runtime checks where types should carry the contract).

## Linting

- Never use oxlint ignore comments to bypass the linter. Fix or restructure the code instead.

## Tests

- Make sure any tests are high value tests. See the `tests` skill.
