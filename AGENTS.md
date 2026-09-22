# AGENTS.md

Booking website for podcast studio. Includes internal dashboard for admins to manage bookings.
Extremely important website is accessible, and as fast first paint on marketing pages as possible. SEO is a priority.

## Stack

- Bun
- default to shadcn for ui
- t3env

## Behaviour

- Ask before making assumptions that change behavior, UX, architecture
- If a problem/code can be solved in a simpler way, propose it
- If a task contains lots of changes which would result in a massive commit, propose splitting into different commits per large change or file changed.

Writing code is cheap for you, which makes over-engineering easy. Counter it by borrowing a human maintainer's fatigue. Aim for the most result with the least code and complexity.

- **Prefer deletion.** When asked to refactor or improve, look for removals before additions.
- **Maintain a flat call hierarchy.** Avoid deep call chains. A rich interface that hides substantial work is not a deep call chain. If answering a question requires tracing through more than 3 files or layers, flatten it.
- **Consolidate decisions.** Do not repeat the same choice in several places. Put it behind one source of truth and pass the result as a simple flag.
- **Minimize the diff.** Make the smallest change that solves the problem. Fewer lines beat "elegant" boilerplate.
- **Question the threading.** If a task asks you to pass a new signal through types, schemas, pipelines, or similar layers, stop and look for a more direct path.
- **Sweat the small leaks.** Remove tiny pass-throughs, representation leaks, and duplicated choices before they spread. Small leaks compound into permanent coordination costs.

**Prime directive:** If a human developer would find the code exhausting to maintain, it is a bad solution. Be lazy. Stay simple.

## Code Style Guidelines

### Naming Conventions

- component files: `PascalCase.tsx`.

### Components and pages

- Extract major or self-contained UI sections into separate component files instead of growing a single large component file
- Group related React setup/state in clear sections, use short section comments for group
- Add short comments before `useEffect` blocks that explain what effect does

### Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).
- Do not add classes that already exist in the parent component
- For loading, show animated spinner icon alongside concise state label (eg. `Saving`), not just trailing-ellipsis label eg. `Saving...`.

### Good Practices

- Always use KISS, YAGNI, and DRY principles
- Before adding helper functions, check if similar function already exist in codebase
- Do not add wrapper functions, inline return arrows, barrel files, or factory helpers. Restructure the code instead, such as splitting hooks, extracting component, or moving logic into `lib/` files. If linting errors occur, then it means the code can likely be restructured in a cleaner way
- Every extraction must own real responsibility. If it only forwards or reconnects code split, undo the split and restructure
- Move reusable helpers, constants, and mappers into nearest appropriate `lib/` file instead of keeping them inside components, routes, or backend functions

### Comments

- Annotate complex/long functions and conditionals with simple comments to make the flow easier to understand.
- Preserve existing comments during refactors; do not delete comments just because code moved.
- Update comments when behavior changes so they stay accurate.

### Verify changes

- Run format, lint, test, typecheck, dead-code, dupes (bun scripts) once changes are complete and before creating any PRs. (e2e only if relevant)
- dont run build or convex codegen unless asked to
- never use eslint ignore to bypass linter

## TypeScript

- Type names: `PascalCase`.
- Dont use nested ternaries and if statements
- Use discriminated unions for app state. Avoid boolean flags and optional fields that allow invalid combinations.
- Handle every union variant with `exhaustiveCheck` default
- Parse boundary data once with Zod.
- Dont write like a python dev

## Convex

- For Convex code, always read `convex/_generated/ai/guidelines.md` first.

- Dont duplicate constants/defaults between frontend and Convex; extract shared values to one importable source when possible.
- Dont suffix internal Convex function names with `Internal` or similar; these things are obvious from looking at the code already

- Dont blindly assume a migration needs to occur or backwards compatibility is necessary. Usually, feature being worked on isnt implemented so no live data. Always ask to clarify.

- Services whose handlers are exported in the same API module may need an explicit `ResultAsync<..., { reason: string }>` return type to break circular inference.

### Neverthrow

- Keep Convex handlers as boundary adapters: each handler should call one service function and use `.match(tupleOk, tupleErr)` to convert service `Result` into tuple returned to client.
- `convex/services` should only contain service chain functions, a readable neverthrow `andThen` chain of domain operations. Chain errors propagate to the handler automatically.
- Put domain operations used by service chains in nearest appropriate file under `convex/lib`. Do not define helper operations in service files
- Result helpers in `convex/lib/result.ts`. Don't call `fromSafePromise`/`fromPromise` directly.
  - `okOrThrow` — `ctx.db`, `runQuery`/`runMutation` returning raw values. Infra failure throws; domain errors (`NOT_FOUND`, etc.) you return in `.andThen`.
  - `fromConvexTuple` — `runQuery`/`runMutation` whose handler uses `.match(tupleOk, tupleErr)`.
  - `tryPromise` — external APIs (Stripe, Resend, Google, render). Failure becomes domain `err` in `catch`.

## Tests

When writing or reviewing tests, use the `tests` skill.
